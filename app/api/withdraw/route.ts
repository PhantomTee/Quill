import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// POST /api/withdraw — record a USDC withdrawal request
// Full CCTP bridge execution is handled off-chain by the seller
export async function POST(request: NextRequest) {
  try {
    const { sellerAddress, agentId, amountUsdc, destinationChain, destinationAddress } =
      await request.json();

    if (!sellerAddress || !amountUsdc || !destinationChain || !destinationAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(destinationAddress)) {
      return NextResponse.json({ error: "Invalid destination address" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("withdrawals")
      .insert({
        seller_address: sellerAddress.toLowerCase(),
        agent_id: agentId ?? null,
        amount_usdc: parseFloat(amountUsdc),
        destination_chain: destinationChain,
        destination_address: destinationAddress.toLowerCase(),
        status: "submitted",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ withdrawal: data }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET /api/withdraw?seller=0x... — list withdrawal history for a seller
export async function GET(request: NextRequest) {
  const seller = request.nextUrl.searchParams.get("seller");
  if (!seller) {
    return NextResponse.json({ error: "seller query param required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("seller_address", seller.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ withdrawals: data });
}
