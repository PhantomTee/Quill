import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("agent_id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const { data: payments } = await supabase
      .from("payment_events")
      .select("id, payer, amount_usdc, gateway_tx, created_at, status")
      .eq("agent_id", data.agent_id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ agent: data, payments: payments ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { serviceUrl, pricePerCall, description, ownerAddress } = body;

    const { data: agent } = await supabase
      .from("agents")
      .select("owner_address")
      .eq("agent_id", id)
      .single();

    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (agent.owner_address !== ownerAddress?.toLowerCase()) {
      return NextResponse.json({ error: "Not the agent owner" }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (serviceUrl) updates.service_url = serviceUrl;
    if (pricePerCall) updates.price_per_call = Math.round(parseFloat(pricePerCall) * 1_000_000);
    if (description) updates.description = description;

    const { data, error } = await supabase
      .from("agents")
      .update(updates)
      .eq("agent_id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ agent: data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get("ownerAddress");

    const { data: agent } = await supabase
      .from("agents")
      .select("owner_address")
      .eq("agent_id", id)
      .single();

    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    if (agent.owner_address !== ownerAddress?.toLowerCase()) {
      return NextResponse.json({ error: "Not the agent owner" }, { status: 403 });
    }

    const { error } = await supabase
      .from("agents")
      .update({ is_active: false })
      .eq("agent_id", id);

    if (error) throw error;
    return NextResponse.json({ deactivated: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
