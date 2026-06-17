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

export function encodePaymentRequired(requirements: X402Requirements): string {
  return Buffer.from(JSON.stringify(requirements)).toString("base64");
}

export function decodePaymentSignature(header: string): X402PaymentPayload | null {
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8")) as X402PaymentPayload;
  } catch {
    return null;
  }
}

export function paymentRequiredResponse(
  priceAtomicUnits: string,
  sellerAddress: string,
  resourceUrl: string,
  description: string
): NextResponse {
  const requirements = buildPaymentRequired(priceAtomicUnits, sellerAddress, resourceUrl, description);
  return NextResponse.json({}, {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": encodePaymentRequired(requirements),
      "Content-Type": "application/json",
    },
  });
}

export type VerifyOnlyResult =
  | { valid: true; payer: string; facilitator: unknown; payload: X402PaymentPayload }
  | { valid: false; error: string };

export type SettleResult =
  | { success: true; settlementId: string; amountPaid: string }
  | { success: false; error: string };

// Step 1: verify signature + funds. Does NOT move money.
export async function verifyPayment(
  paymentSignatureHeader: string,
  requirements: X402Requirements
): Promise<VerifyOnlyResult> {
  try {
    const { BatchFacilitatorClient } = await import("@circle-fin/x402-batching/server");
    const facilitator = new BatchFacilitatorClient();

    const payload = decodePaymentSignature(paymentSignatureHeader);
    if (!payload) return { valid: false, error: "Invalid payment-signature header" };

    const verifyResult = await Promise.race([
      facilitator.verify(payload as never, requirements.accepts[0] as never),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Verification timeout")), 5000)
      ),
    ]);

    if (!verifyResult.isValid) {
      return { valid: false, error: `Payment invalid: ${verifyResult.invalidReason ?? "Unknown reason"}` };
    }

    return { valid: true, payer: verifyResult.payer ?? "", facilitator, payload };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, error: `Payment verification error: ${msg}` };
  }
}

// Step 2: settle (moves money). Call only after delivery succeeds.
export async function settlePayment(
  facilitator: unknown,
  payload: X402PaymentPayload,
  requirements: X402Requirements,
  amount: string
): Promise<SettleResult> {
  try {
    const f = facilitator as { settle: (p: unknown, r: unknown) => Promise<{ success: boolean; transaction?: string; errorReason?: string }> };
    const settleResult = await Promise.race([
      f.settle(payload as never, requirements.accepts[0] as never),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Settlement timeout")), 10000)
      ),
    ]);

    if (!settleResult.success) {
      return { success: false, error: `Settlement failed: ${settleResult.errorReason ?? "Unknown"}` };
    }

    return { success: true, settlementId: settleResult.transaction ?? "", amountPaid: amount };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Settlement error: ${msg}` };
  }
}

export interface WithGatewayOptions {
  priceUSDC: string;
  sellerAddress: string;
  resourceUrl: string;
  description?: string;
  agentId?: number;
}

export type GatewayVerifyResult =
  | { valid: true; payer: string; settlementId: string; amountPaid: string }
  | { valid: false; error: string };

// Combined verify+settle — kept for the worker routes that don't need escrow
export async function verifyAndSettlePayment(
  paymentSignatureHeader: string,
  requirements: X402Requirements
): Promise<GatewayVerifyResult> {
  const verifyResult = await verifyPayment(paymentSignatureHeader, requirements);
  if (!verifyResult.valid) return verifyResult;

  const settleResult = await settlePayment(
    verifyResult.facilitator,
    verifyResult.payload,
    requirements,
    requirements.accepts[0].amount
  );

  if (!settleResult.success) return { valid: false, error: settleResult.error };

  return {
    valid: true,
    payer: verifyResult.payer,
    settlementId: settleResult.settlementId,
    amountPaid: settleResult.amountPaid,
  };
}

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
      return NextResponse.json({ error: result.error }, {
        status: 402,
        headers: { "PAYMENT-REQUIRED": encodePaymentRequired(requirements) },
      });
    }

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

        const amount = parseFloat(formatUSDC(BigInt(result.amountPaid)));
        const { error: rpcErr } = await supabase.rpc("increment_agent_stats", {
          p_agent_id: options.agentId,
          p_amount: amount,
        });
        if (rpcErr) {
          await supabase.rpc("increment_agent_stats", { p_agent_id: options.agentId, p_amount: amount }).then(() => null, () => null);
        }
      } catch {
        // non-fatal
      }
    }

    const response = await handler(req, context);

    if (response.status >= 200 && response.status < 300) {
      response.headers.set("PAYMENT-RESPONSE", Buffer.from(JSON.stringify({
        success: true,
        transaction: result.settlementId,
        network: ARC_NETWORK,
        payer: result.payer,
      })).toString("base64"));
    }

    return response;
  };
}
