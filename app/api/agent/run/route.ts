import { NextRequest, NextResponse } from "next/server";
import { QuillBuyerAgent } from "../../../../lib/agent/buyerAgent";

export async function POST(req: NextRequest) {
  const body = await req.json() as { task?: string; budgetUSDC?: string };

  if (!body.task || typeof body.task !== "string" || body.task.trim().length === 0) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  const budgetUSDC = body.budgetUSDC ?? "0.01";
  const budget = parseFloat(budgetUSDC);

  if (isNaN(budget) || budget <= 0 || budget > 1) {
    return NextResponse.json({ error: "budgetUSDC must be between 0 and 1 USDC" }, { status: 400 });
  }

  const privateKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey || !privateKey.startsWith("0x")) {
    return NextResponse.json({ error: "BUYER_PRIVATE_KEY not configured on server" }, { status: 500 });
  }

  try {
    const agent = new QuillBuyerAgent(privateKey);
    const result = await agent.run(body.task.trim(), budgetUSDC);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
