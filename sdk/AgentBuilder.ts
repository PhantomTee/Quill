import type { AgentRegistration } from "./types";

const QUILL_API = process.env.NEXT_PUBLIC_APP_URL ?? "https://quill.vercel.app";

/**
 * AgentBuilder — for agent sellers: register on Quill and protect endpoints with x402
 *
 * Usage (Next.js App Router):
 *   const builder = new AgentBuilder({ sellerAddress: "0x...", privateKey: "0x..." })
 *   await builder.register({ name: "My Agent", serviceUrl: "...", pricePerCall: "0.01", ... })
 *
 *   // In your API route:
 *   export const POST = builder.protect(async (req) => {
 *     return Response.json({ result: "..." })
 *   }, { priceUSDC: "0.01", resourceUrl: "/api/my-endpoint" })
 */
export class AgentBuilder {
  private sellerAddress: string;
  private privateKey?: string;
  private facilitator: unknown = null;

  constructor(options: { sellerAddress: string; privateKey?: string }) {
    this.sellerAddress = options.sellerAddress;
    this.privateKey = options.privateKey;
  }

  private async getFacilitator() {
    if (!this.facilitator) {
      const { BatchFacilitatorClient } = await import("@circle-fin/x402-batching/server");
      this.facilitator = new BatchFacilitatorClient({
        url: "https://gateway-api-testnet.circle.com",
        arcPrivateMainnet: false,
      });
    }
    return this.facilitator as {
      verify: (payload: unknown, requirements: unknown) => Promise<{ isValid: boolean; invalidReason?: string; payer?: string }>;
      settle: (payload: unknown, requirements: unknown) => Promise<{ success: boolean; transaction: string }>;
    };
  }

  async register(registration: AgentRegistration & { ownerAddress: string; txHash: string }): Promise<{ agentId: number; txHash: string }> {
    const res = await fetch(`${QUILL_API}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registration),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  protect(
    handler: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>,
    options: { priceUSDC: string; resourceUrl: string }
  ): (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse> {
    return async (req) => {
      const { withGateway } = await import("../lib/x402");
      const wrapped = withGateway(handler, {
        priceUSDC: options.priceUSDC,
        sellerAddress: this.sellerAddress,
        resourceUrl: options.resourceUrl,
      });
      return wrapped(req);
    };
  }

  async getBalance(): Promise<{ available: string }> {
    const { getPublicClient, USDC_ADDRESS } = await import("../lib/arc");
    const { formatUnits } = await import("viem");
    const client = getPublicClient();
    const balance = await client.readContract({
      address: USDC_ADDRESS as `0x${string}`,
      abi: [{ name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }],
      functionName: "balanceOf",
      args: [this.sellerAddress as `0x${string}`],
    });
    return { available: formatUnits(balance as bigint, 6) };
  }
}
