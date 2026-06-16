import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const [agentsResult, callsResult, volumeResult, topAgentsResult] = await Promise.all([
      supabase.from("agents").select("agent_id, is_active, tags", { count: "exact" }),
      supabase.from("payment_events").select("id", { count: "exact" }),
      supabase.from("payment_events").select("amount_usdc"),
      supabase
        .from("agents")
        .select("agent_id, name, total_calls, total_revenue")
        .eq("is_active", true)
        .order("total_calls", { ascending: false })
        .limit(6),
    ]);

    const totalVolume =
      volumeResult.data?.reduce((sum, c) => sum + parseFloat(String(c.amount_usdc)), 0) ?? 0;
    const activeAgents = agentsResult.data?.filter((a) => a.is_active).length ?? 0;

    // Recent payments for live feed
    const { data: recentPayments } = await supabase
      .from("payment_events")
      .select("payer, amount_usdc, created_at, agent_id")
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      totalAgents: agentsResult.count ?? 0,
      activeAgents,
      totalCalls: callsResult.count ?? 0,
      totalVolumeUSDC: totalVolume.toFixed(6),
      topAgents: topAgentsResult.data ?? [],
      recentPayments: recentPayments ?? [],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
