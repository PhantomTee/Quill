/**
 * x402Middleware — framework adapters for protecting endpoints with x402 payment gates
 *
 * Supported:
 *   - Next.js App Router (withNextGateway)
 *   - Express / Node.js HTTP (expressGateway)
 *   - Fetch API handler (withFetchGateway)
 */

export interface GatewayOptions {
  priceUSDC: string;
  sellerAddress: string;
  resourceUrl: string;
  description?: string;
}

// Next.js App Router
export function withNextGateway(
  handler: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>,
  options: GatewayOptions
): (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse> {
  return async (req) => {
    const { withGateway } = await import("../lib/x402");
    const wrapped = withGateway(handler, options);
    return wrapped(req);
  };
}

// Express.js / Connect middleware
export function expressGateway(options: GatewayOptions) {
  return async (req: unknown, res: unknown, next: (err?: unknown) => void) => {
    const r = req as { headers: Record<string, string>; body?: unknown; method?: string; url?: string };
    const paymentHeader = r.headers["payment-signature"];

    if (!paymentHeader) {
      const { buildPaymentRequired, encodePaymentRequired } = await import("../lib/x402");
      const priceAtomicUnits = Math.round(parseFloat(options.priceUSDC) * 1_000_000).toString();
      const reqs = buildPaymentRequired(
        priceAtomicUnits,
        options.sellerAddress as `0x${string}`,
        options.resourceUrl,
        options.description ?? `Access to ${options.resourceUrl}`
      );
      const encoded = encodePaymentRequired(reqs);
      const response = res as { status: (code: number) => { json: (body: unknown) => void }; setHeader: (k: string, v: string) => void };
      response.setHeader("PAYMENT-REQUIRED", encoded);
      response.status(402).json({ error: "Payment required", requirements: reqs });
      return;
    }

    next();
  };
}

// Generic fetch-compatible handler (alias for Next.js)
export function withFetchGateway(
  handler: (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse>,
  options: GatewayOptions
): (req: import("next/server").NextRequest) => Promise<import("next/server").NextResponse> {
  return withNextGateway(handler, options);
}
