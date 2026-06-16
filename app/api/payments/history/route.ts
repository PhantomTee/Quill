import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const walletAddress = searchParams.get("wallet");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));
    const offset = (page - 1) * limit;

    let query = supabase
      .from("payment_events")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentId) query = query.eq("agent_id", agentId);
    if (walletAddress) query = query.eq("payer", walletAddress.toLowerCase());

    const { data, error, count } = await query;
    if (error) throw error;

    const totalRevenue =
      data?.reduce((sum, p) => sum + parseFloat(String(p.amount_usdc)), 0) ?? 0;

    return NextResponse.json({
      payments: data ?? [],
      total: count ?? 0,
      totalRevenue: totalRevenue.toFixed(6),
      page,
      limit,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
