import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Webhook endpoint for Circle Gateway payment notifications
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, transaction, payer, amount, agentId, network } = body;

    if (event === "payment.confirmed" && transaction) {
      // Update payment status to confirmed when batch settles on-chain
      await supabase
        .from("payment_events")
        .update({ status: "confirmed", batch_tx: transaction })
        .eq("gateway_tx", body.settlementId ?? transaction);

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true, ignored: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
