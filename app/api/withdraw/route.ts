import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getPublicClient, ERC20_ABI, USDC_ADDRESS, formatUSDC } from "@/lib/arc";

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

// GET /api/withdraw?wallet=0x... — on-chain USDC balance for a wallet
// GET /api/withdraw?seller=0x... — withdrawal history for a seller
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  const seller = request.nextUrl.searchParams.get("seller");

  // On-chain balance check
  if (wallet) {
    try {
      const client = getPublicClient();
      const raw = await client.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet as `0x${string}`],
      }) as bigint;
      return NextResponse.json({ wallet, balanceUSDC: formatUSDC(raw), balanceRaw: raw.toString() });
    } catch (e: unknown) {
      return NextResponse.json({ wallet, balanceUSDC: "0", error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (!seller) {
    return NextResponse.json({ error: "wallet or seller query param required" }, { status: 400 });
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
