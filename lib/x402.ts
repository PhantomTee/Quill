import { NextRequest, NextResponse } from "next/server";
import { USDC_ADDRESS, ARC_CHAIN_ID, GATEWAY_WALLET, formatUSDC } from "./arc";
import { supabase } from "./supabase";

// x402 protocol constants
export const ARC_NETWORK = `eip155:${ARC_CHAIN_ID}`;
export const MAX_TIMEOUT_SECONDS = 345600; // 4 days

export interface X402Requirements {
  x402Version: number;
  resource: {
    url: string;
    description: string;
    mimeType: string;
  };
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: {
      name: string;
      version: string;
      verifyingContract: string;
    };
  }>;
}

export interface X402PaymentPayload {
  x402Version: number;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      asset: string;
      amount: string;
      validAfter: number;
      validBefore: number;
      nonce: string;
    };
  };
  extensions: Record<string, unknown>;
}

export function buildPaymentRequired(
  priceAtomicUnits: string,
  sellerAddress: string,
  resourceUrl: string,
  description: string
): X402Requirements {
  return {
    x402Version: 2,
    resource: {
      url: resourceUrl,
      description,
      mimeType: "application/json",
    },
    accepts: [{
      scheme: "exact",
      network: ARC_NETWORK,
      asset: USDC_ADDRESS,
      amount: priceAtomicUnits,
      payTo: sellerAddress,
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      extra: {
        name: "GatewayWalletBatched",
        version: "1",
        verifyingContract: GATEWAY_WALLET,
      },
    }],
  };
}

// Encode requirements as base64 for the PAYMENT-REQUIRED header
export function encodePaymentRequired(requirements: X402Requirements): string {
  return Buffer.from(JSON.stringify(requirements)).toString("base64");
}

// Decode payment-signature header
export function decodePaymentSignature(header: string): X402PaymentPayload | null {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    return JSON.parse(decoded) as X402PaymentPayload;
  } catch {
    return null;
  }
}

// Return a 402 Payment Required response
export function paymentRequiredResponse(
  priceAtomicUnits: string,
  sellerAddress: string,
  resourceUrl: string,
  description: string
): NextResponse {
  const requirements = buildPaymentRequired(priceAtomicUnits, sellerAddress, resourceUrl, description);
  const encoded = encodePaymentRequired(requirements);

  return NextResponse.json(
    {},
    {
      status: 402,
      headers: {
        "PAYMENT-REQUIRED": encoded,
        "Content-Type": "application/json",
      },
    }
  );
}

export interface WithGatewayOptions {
  priceUSDC: string;           // e.g. "0.01"
  sellerAddress: string;       // wallet receiving USDC
  resourceUrl: string;         // the URL being protected
  description?: string;
  agentId?: number;
}

export type GatewayVerifyResult =
  | { valid: true; payer: string; settlementId: string; amountPaid: string }
  | { valid: false; error: string };

// Verify a payment-signature against Circle Gateway
// Falls back to simplified verification if @circle-fin/x402-batching is not available
export async function verifyAndSettlePayment(
  paymentSignatureHeader: string,
  requirements: X402Requirements
): Promise<GatewayVerifyResult> {
  try {
    // Try to use Circle Gateway BatchFacilitatorClient
    const { BatchFacilitatorClient } = await import("@circle-fin/x402-batching/server");
    const facilitator = new BatchFacilitatorClient();

    const payload = decodePaymentSignature(paymentSignatureHeader);
    if (!payload) return { valid: false, error: "Invalid payment-signature header" };

    // Run with a 5-second timeout
    const verifyResult = await Promise.race([
      facilitator.verify(payload as any, requirements as any),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Verification timeout")), 5000)
      ),
    ]);

    if (!verifyResult.isValid) {
      return { valid: false, error: `Payment invalid: ${verifyResult.invalidReason ?? "Unknown reason"}` };
    }

    const settleResult = await Promise.race([
      facilitator.settle(payload as any, requirements as any),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Settlement timeout")), 10000)
      ),
    ]);

    if (!settleResult.success) {
      return { valid: false, error: `Settlement failed: ${settleResult.errorReason ?? "Unknown"}` };
    }

    return {
      valid: true,
      payer: settleResult.payer ?? verifyResult.payer ?? "",
      settlementId: settleResult.transaction ?? "",
      amountPaid: requirements.accepts[0].amount,
    };
  } catch (e: unknown) {
    // If Circle SDK is not available, return error
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, error: `Payment verification error: ${msg}` };
  }
}

// Middleware wrapper for Next.js App Router route handlers
export function withGateway(
  handler: (req: NextRequest, context?: { params: { [key: string]: string } }) => Promise<NextResponse>,
  options: WithGatewayOptions
) {
  return async (req: NextRequest, context?: { params: { [key: string]: string } }): Promise<NextResponse> => {
    const priceAtomicUnits = Math.round(parseFloat(options.priceUSDC) * 1_000_000).toString();
    const description = options.description ?? `Access to ${options.resourceUrl}`;

    const paymentSignature = req.headers.get("payment-signature");

    if (!paymentSignature) {
      return paymentRequiredResponse(priceAtomicUnits, options.sellerAddress, options.resourceUrl, description);
    }

    const requirements = buildPaymentRequired(priceAtomicUnits, options.sellerAddress, options.resourceUrl, description);
    const result = await verifyAndSettlePayment(paymentSignature, requirements);

    if (!result.valid) {
      const requirements2 = buildPaymentRequired(priceAtomicUnits, options.sellerAddress, options.resourceUrl, description);
      const encoded = encodePaymentRequired(requirements2);
      return NextResponse.json(
        { error: result.error },
        {
          status: 402,
          headers: { "PAYMENT-REQUIRED": encoded },
        }
      );
    }

    // Record payment event
    if (options.agentId) {
      try {
        await supabase.from("payment_events").insert({
          agent_id: options.agentId,
          endpoint: options.resourceUrl,
          payer: result.payer.toLowerCase(),
          amount_usdc: parseFloat(formatUSDC(BigInt(result.amountPaid))),
          amount_raw: result.amountPaid,
          network: ARC_NETWORK,
          gateway_tx: result.settlementId,
          status: "settled",
          raw: { requirements, settlementId: result.settlementId },
        });

        // Update agent stats
        await supabase.rpc("increment_agent_stats", {
          p_agent_id: options.agentId,
          p_amount: parseFloat(formatUSDC(BigInt(result.amountPaid))),
        }).then(() => {}, () => {});
      } catch {
        // Non-fatal — log but don't block the response
      }
    }

    // Execute handler
    const response = await handler(req, context);

    // Add payment response header on success
    if (response.status >= 200 && response.status < 300) {
      const paymentResponse = {
        success: true,
        transaction: result.settlementId,
        network: ARC_NETWORK,
        payer: result.payer,
      };
      response.headers.set("PAYMENT-RESPONSE", Buffer.from(JSON.stringify(paymentResponse)).toString("base64"));
    }

    return response;
  };
}
