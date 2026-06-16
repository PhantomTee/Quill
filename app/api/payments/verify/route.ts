import { NextRequest, NextResponse } from "next/server";
import { buildPaymentRequired, verifyAndSettlePayment } from "@/lib/x402";

export async function POST(request: NextRequest) {
  try {
    const { paymentSignature, priceAtomicUnits, sellerAddress, resourceUrl } = await request.json();

    if (!paymentSignature || !priceAtomicUnits || !sellerAddress || !resourceUrl) {
      return NextResponse.json(
        { error: "paymentSignature, priceAtomicUnits, sellerAddress, resourceUrl required" },
        { status: 400 }
      );
    }

    const requirements = buildPaymentRequired(
      String(priceAtomicUnits),
      sellerAddress,
      resourceUrl,
      "Payment verification"
    );

    const result = await verifyAndSettlePayment(paymentSignature, requirements);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
