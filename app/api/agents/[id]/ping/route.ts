import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: agent } = await supabase
    .from("agents")
    .select("service_url, is_active")
    .eq("agent_id", id)
    .single();

  if (!agent || !agent.is_active) {
    return NextResponse.json({ healthy: false, reason: "inactive" });
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(agent.service_url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    // 402 means alive (agent is live but needs payment)
    const healthy = res.status < 500 || res.status === 402;
    return NextResponse.json({ healthy, latencyMs, status: res.status });
  } catch {
    return NextResponse.json({ healthy: false, latencyMs: Date.now() - start, reason: "unreachable" });
  }
}
