import type { QuillAgent, CallResult } from "./types";

const QUILL_API = process.env.NEXT_PUBLIC_APP_URL ?? "https://quill.vercel.app";

/**
 * AgentCaller — for buyers: discover agents and call them via x402
 *
 * Usage:
 *   const caller = new AgentCaller({ privateKey: "0x..." })
 *   const agents = await caller.findAgents({ tag: "nlp", maxPrice: "0.05" })
 *   const result = await caller.call(agents[0], { text: "..." })
 *
 * The caller automatically handles the x402 payment flow:
 *   1. Makes request → gets 402 with PAYMENT-REQUIRED header
 *   2. Signs EIP-3009 authorization using Circle batching scheme
 *   3. Re-sends request with payment-signature header
 *   4. Returns the response data
 */
export class AgentCaller {
  private privateKey: `0x${string}`;

  constructor(options: { privateKey: `0x${string}` }) {
    this.privateKey = options.privateKey;
  }

  async findAgents(options: { q?: string; tag?: string; maxPrice?: string; limit?: number } = {}): Promise<QuillAgent[]> {
    const params = new URLSearchParams();
    if (options.q) params.set("q", options.q);
    if (options.tag) params.set("tag", options.tag);
    if (options.maxPrice) params.set("maxPrice", options.maxPrice);
    if (options.limit) params.set("limit", String(options.limit));

    const res = await fetch(`${QUILL_API}/api/agents?${params}`);
    const data = await res.json() as { agents?: Record<string, unknown>[] };
    return (data.agents ?? []).map((a) => ({
      agentId: a.agent_id as number,
      name: a.name as string,
      description: (a.description ?? null) as string | null,
      serviceUrl: a.service_url as string,
      pricePerCall: BigInt(String(a.price_per_call)),
      priceFormatted: (Number(a.price_per_call) / 1_000_000).toFixed(6),
      walletAddress: a.wallet_address as string,
      tags: (a.tags ?? []) as string[],
      totalCalls: (a.total_calls ?? 0) as number,
      totalRevenue: String(a.total_revenue ?? "0"),
    }));
  }

  async call<T = unknown>(
    agent: QuillAgent,
    body: unknown,
    options: { method?: string; headers?: Record<string, string> } = {}
  ): Promise<CallResult<T>> {
    const start = Date.now();
    const callUrl = `${QUILL_API}/api/agents/${agent.agentId}/call`;

    try {
      // Step 1: probe for payment requirements
      const probeRes = await fetch(callUrl, {
        method: options.method ?? "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify(body),
      });

      if (probeRes.status !== 402) {
        const data = await probeRes.json() as T;
        return { success: true, data, latencyMs: Date.now() - start };
      }

      const prHeader = probeRes.headers.get("PAYMENT-REQUIRED");
      if (!prHeader) throw new Error("402 response missing PAYMENT-REQUIRED header");

      const requirements = JSON.parse(Buffer.from(prHeader, "base64").toString("utf8")) as {
        x402Version: number;
        accepts: Array<{ scheme: string; network: string; asset: string; amount: string; payTo: string; maxTimeoutSeconds: number; extra?: Record<string, unknown> }>;
      };

      // Step 2: sign payment
      const { privateKeyToAccount } = await import("viem/accounts");
      const { BatchEvmScheme } = await import("@circle-fin/x402-batching/client");

      const account = privateKeyToAccount(this.privateKey);
      const signer = {
        address: account.address,
        signTypedData: async (params: Parameters<typeof account.signTypedData>[0]) =>
          account.signTypedData(params),
      };

      const scheme = new BatchEvmScheme(signer);
      const accept = requirements.accepts[0];
      const paymentPayload = await scheme.createPaymentPayload(requirements.x402Version, accept);
      const paymentSignature = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

      // Step 3: retry with payment
      const paidRes = await fetch(callUrl, {
        method: options.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          "payment-signature": paymentSignature,
          ...options.headers,
        },
        body: JSON.stringify(body),
      });

      if (!paidRes.ok) {
        const err = await paidRes.json().catch(() => ({ error: `HTTP ${paidRes.status}` })) as { error?: string };
        throw new Error(err.error ?? `HTTP ${paidRes.status}`);
      }

      const data = await paidRes.json() as T;
      const prResponseHeader = paidRes.headers.get("PAYMENT-RESPONSE");
      let settlementId = "";
      if (prResponseHeader) {
        try {
          const decoded = JSON.parse(Buffer.from(prResponseHeader, "base64").toString("utf8")) as { transaction?: string };
          settlementId = decoded.transaction ?? "";
        } catch {}
      }

      return {
        success: true,
        data,
        settlementId,
        amountPaid: (Number(accept.amount) / 1_000_000).toFixed(6),
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
