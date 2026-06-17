import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("agent_ratings")
    .select("stars")
    .eq("agent_id", id);

  if (error) {
    // Table may not exist yet
    return NextResponse.json({ avgRating: null, count: 0, ratings: [] });
  }

  const ratings = data ?? [];
  const count = ratings.length;
  const avgRating = count > 0
    ? ratings.reduce((s, r) => s + r.stars, 0) / count
    : null;

  return NextResponse.json({ avgRating: avgRating ? parseFloat(avgRating.toFixed(1)) : null, count });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const stars = Number(body.stars);
  const payer = String(body.payer ?? "").toLowerCase().trim();
  const comment = body.comment ? String(body.comment).slice(0, 500) : null;

  if (!payer || !/^0x[0-9a-f]{40}$/i.test(payer)) {
    return NextResponse.json({ error: "Valid payer wallet address required" }, { status: 400 });
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "stars must be 1–5" }, { status: 400 });
  }

  // Verify payer has actually called this agent (anti-spam)
  const { data: callRecord } = await supabase
    .from("payment_events")
    .select("id")
    .eq("agent_id", id)
    .eq("payer", payer)
    .eq("status", "settled")
    .limit(1)
    .single();

  if (!callRecord) {
    return NextResponse.json(
      { error: "You must have a settled call to this agent before rating" },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("agent_ratings")
    .upsert(
      { agent_id: parseInt(id), payer, stars, comment },
      { onConflict: "agent_id,payer" }
    );

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "Ratings table not set up yet. Run the migration in supabase/migrations/003_ratings.sql" },
        { status: 503 }
      );
    }
    throw error;
  }

  return NextResponse.json({ success: true, stars, payer });
}
