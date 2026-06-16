import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { paymentRequiredResponse, verifyAndSettlePayment, buildPaymentRequired, encodePaymentRequired, ARC_NETWORK } from "@/lib/x402";
import { formatUSDC } from "@/lib/arc";

// Block private/loopback IP ranges to prevent SSRF attacks
function isPrivateUrl(urlStr: string): boolean {
  try {
    const { hostname, protocol } = new URL(urlStr);
    if (protocol !== "https:" && protocol !== "http:") return true;
    // Block localhost variants
    if (/^(localhost|127\.|0\.0\.0\.0|::1)/.test(hostname)) return true;
    // Block RFC-1918 private ranges: 10.x, 172.16-31.x, 192.168.x
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    // Block link-local and metadata endpoints
    if (/^169\.254\./.test(hostname)) return true;
    if (/^(fd|fc)[0-9a-f]{2}:/i.test(hostname)) return true;
    // Block AWS/GCP/Azure metadata endpoints
    if (hostname === "metadata.google.internal") return true;
    return false;
  } catch {
    return true;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id } = await params;

  try {
    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("agent_id", id)
      .eq("is_active", true)
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: "Agent not found or not active" }, { status: 404 });
    }

    const priceAtomicUnits = String(agent.price_per_call);
    const resourceUrl = `/api/agents/${id}/call`;
    const description = `Call to ${agent.name}`;
    const paymentSignature = request.headers.get("payment-signature");

    if (!paymentSignature) {
      return paymentRequiredResponse(priceAtomicUnits, agent.wallet_address, resourceUrl, description);
    }

    const requirements = buildPaymentRequired(priceAtomicUnits, agent.wallet_address, resourceUrl, description);
    const verifyResult = await verifyAndSettlePayment(paymentSignature, requirements);

    if (!verifyResult.valid) {
      const encoded = encodePaymentRequired(requirements);
      return NextResponse.json(
        { error: verifyResult.error },
        { status: 402, headers: { "PAYMENT-REQUIRED": encoded } }
      );
    }

    // Proxy to agent endpoint — block private/loopback URLs (SSRF)
    if (isPrivateUrl(agent.service_url)) {
      return NextResponse.json({ error: "Agent service URL points to a private network address" }, { status: 400 });
    }

    const body = await request.text();
    const agentResponse = await fetch(agent.service_url, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("Content-Type") ?? "application/json",
        "X-Quill-Caller": verifyResult.payer,
        "X-Quill-Agent-Id": String(id),
        "X-Quill-Paid": formatUSDC(BigInt(priceAtomicUnits)),
      },
      body: body || undefined,
      signal: AbortSignal.timeout(30000),
    });

    const responseData = await agentResponse.text();
    const latency = Date.now() - startTime;

    // Record payment event
    await supabase.from("payment_events").insert({
      agent_id: agent.agent_id,
      endpoint: resourceUrl,
      payer: verifyResult.payer.toLowerCase(),
      amount_usdc: parseFloat(formatUSDC(BigInt(priceAtomicUnits))),
      amount_raw: priceAtomicUnits,
      network: ARC_NETWORK,
      gateway_tx: verifyResult.settlementId,
      status: "settled",
      raw: { agentId: id, latencyMs: latency },
    });

    // Update agent stats
    await supabase
      .from("agents")
      .update({
        total_calls: agent.total_calls + 1,
        total_revenue: (parseFloat(agent.total_revenue) + parseFloat(formatUSDC(BigInt(priceAtomicUnits)))).toFixed(6),
      })
      .eq("agent_id", id);

    const paymentResponseHeader = Buffer.from(JSON.stringify({
      success: true,
      transaction: verifyResult.settlementId,
      network: ARC_NETWORK,
      payer: verifyResult.payer,
    })).toString("base64");

    return new NextResponse(responseData, {
      status: agentResponse.status,
      headers: {
        "Content-Type": agentResponse.headers.get("Content-Type") ?? "application/json",
        "PAYMENT-RESPONSE": paymentResponseHeader,
        "X-Quill-Agent-Id": String(id),
        "X-Quill-Latency-Ms": String(latency),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
