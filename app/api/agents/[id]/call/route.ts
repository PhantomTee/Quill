import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  paymentRequiredResponse,
  verifyPayment,
  settlePayment,
  buildPaymentRequired,
  encodePaymentRequired,
  ARC_NETWORK,
} from "@/lib/x402";
import { formatUSDC } from "@/lib/arc";

// Block private/loopback IP ranges to prevent SSRF attacks
function isPrivateUrl(urlStr: string): boolean {
  try {
    const { hostname, protocol } = new URL(urlStr);
    if (protocol !== "https:" && protocol !== "http:") return true;
    if (/^(localhost|127\.|0\.0\.0\.0|::1)/.test(hostname)) return true;
    if (/^10\./.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
    if (/^192\.168\./.test(hostname)) return true;
    if (/^169\.254\./.test(hostname)) return true;
    if (/^(fd|fc)[0-9a-f]{2}:/i.test(hostname)) return true;
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

    // SSRF check first — before any payment is processed
    if (isPrivateUrl(agent.service_url)) {
      return NextResponse.json(
        { error: "Agent service URL points to a private network address" },
        { status: 400 }
      );
    }

    const priceAtomicUnits = String(agent.price_per_call);
    const resourceUrl = `/api/agents/${id}/call`;
    const description = `Call to ${agent.name}`;
    const paymentSignature = request.headers.get("payment-signature");

    if (!paymentSignature) {
      return paymentRequiredResponse(priceAtomicUnits, agent.wallet_address, resourceUrl, description);
    }

    const requirements = buildPaymentRequired(priceAtomicUnits, agent.wallet_address, resourceUrl, description);

    // Step 1: verify only — no money moves yet
    const verifyResult = await verifyPayment(paymentSignature, requirements);
    if (!verifyResult.valid) {
      return NextResponse.json(
        { error: verifyResult.error },
        { status: 402, headers: { "PAYMENT-REQUIRED": encodePaymentRequired(requirements) } }
      );
    }

    // Step 2: proxy to agent
    const body = await request.text();
    let agentResponse: Response;
    let responseData: string;
    let agentSucceeded = false;

    try {
      agentResponse = await fetch(agent.service_url, {
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
      responseData = await agentResponse.text();
      agentSucceeded = agentResponse.status >= 200 && agentResponse.status < 300;
    } catch (e: unknown) {
      // Agent timed out or network error — settle is still owed (caller paid for compute)
      responseData = JSON.stringify({ error: e instanceof Error ? e.message : "Agent unreachable" });
      agentSucceeded = false;
      agentResponse = new Response(responseData, { status: 502 });
    }

    // Step 3: settle — money moves after delivery attempt
    const settleResult = await settlePayment(
      verifyResult.facilitator,
      verifyResult.payload,
      requirements,
      priceAtomicUnits
    );

    const latency = Date.now() - startTime;
    const amountUSDC = parseFloat(formatUSDC(BigInt(priceAtomicUnits)));
    const paymentStatus = !settleResult.success
      ? "settlement_failed"
      : agentSucceeded
      ? "settled"
      : "settled_agent_error";

    // Record payment event with real outcome
    await supabase.from("payment_events").insert({
      agent_id: agent.agent_id,
      endpoint: resourceUrl,
      payer: verifyResult.payer.toLowerCase(),
      amount_usdc: amountUSDC,
      amount_raw: priceAtomicUnits,
      network: ARC_NETWORK,
      gateway_tx: settleResult.success ? settleResult.settlementId : null,
      status: paymentStatus,
      raw: { agentId: id, latencyMs: latency, agentStatus: agentResponse.status },
    }).then(() => null, () => null);

    // Update stats atomically — only on successful agent response
    if (settleResult.success && agentSucceeded) {
      const { error: rpcErr } = await supabase.rpc("increment_agent_stats", {
        p_agent_id: agent.agent_id,
        p_amount: amountUSDC,
      });
      // Atomic fallback if RPC not yet deployed
      if (rpcErr) {
        await supabase.from("agents")
          .update({ total_calls: agent.total_calls + 1 })
          .eq("agent_id", id)
          .catch(() => null);
      }
    }

    if (!settleResult.success) {
      return NextResponse.json(
        { error: "Payment settlement failed — please retry", detail: settleResult.error },
        { status: 402, headers: { "PAYMENT-REQUIRED": encodePaymentRequired(requirements) } }
      );
    }

    const paymentResponseHeader = Buffer.from(JSON.stringify({
      success: true,
      transaction: settleResult.settlementId,
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
