import { NextRequest, NextResponse } from "next/server";
import { QuillBuyerAgent } from "../../../../lib/agent/buyerAgent";
import { AgentCaller } from "../../../../sdk/AgentCaller";
import { supabase } from "@/lib/supabase";
import { formatUSDC } from "@/lib/arc";
import type { QuillAgent } from "../../../../sdk/types";

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    task?: string;
    budgetUSDC?: string;
    // Pipeline mode: run a fixed sequence of agents, chaining output→input
    pipeline?: number[];
    input?: string;
  };

  const privateKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey || !privateKey.startsWith("0x")) {
    return NextResponse.json({ error: "BUYER_PRIVATE_KEY not configured on server" }, { status: 500 });
  }

  const budgetUSDC = body.budgetUSDC ?? "0.01";
  const budget = parseFloat(budgetUSDC);
  if (isNaN(budget) || budget <= 0 || budget > 2) {
    return NextResponse.json({ error: "budgetUSDC must be between 0 and 2 USDC" }, { status: 400 });
  }

  // ── Pipeline mode ─────────────────────────────────────────────────────────
  if (body.pipeline) {
    const pipeline = body.pipeline;
    if (!Array.isArray(pipeline) || pipeline.length === 0 || pipeline.length > 8) {
      return NextResponse.json({ error: "pipeline must be an array of 1–8 agent IDs" }, { status: 400 });
    }
    const initialInput = String(body.input ?? body.task ?? "").trim();
    if (!initialInput) {
      return NextResponse.json({ error: "input is required for pipeline mode" }, { status: 400 });
    }

    try {
      const result = await runPipeline(privateKey, pipeline, initialInput, budgetUSDC);
      return NextResponse.json(result);
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  // ── Standard autonomous mode ───────────────────────────────────────────────
  if (!body.task || typeof body.task !== "string" || body.task.trim().length === 0) {
    return NextResponse.json({ error: "task or pipeline is required" }, { status: 400 });
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

// ── Pipeline runner ─────────────────────────────────────────────────────────

interface PipelineStep {
  agentId: number;
  agentName: string;
  input: string;
  output: string | null;
  amountPaid: string | null;
  settlementId: string | null;
  latencyMs: number;
  success: boolean;
  error: string | null;
}

interface PipelineResult {
  mode: "pipeline";
  steps: PipelineStep[];
  finalOutput: string | null;
  totalSpentUSDC: string;
  budgetRemaining: string;
  success: boolean;
}

async function runPipeline(
  privateKey: `0x${string}`,
  agentIds: number[],
  initialInput: string,
  budgetUSDC: string
): Promise<PipelineResult> {
  let remaining = parseFloat(budgetUSDC);
  let totalSpent = 0;
  const steps: PipelineStep[] = [];
  const caller = new AgentCaller({ privateKey });

  let currentInput = initialInput;

  for (const agentId of agentIds) {
    if (remaining <= 0) {
      steps.push({
        agentId,
        agentName: `Agent #${agentId}`,
        input: currentInput,
        output: null,
        amountPaid: null,
        settlementId: null,
        latencyMs: 0,
        success: false,
        error: "Budget exhausted",
      });
      break;
    }

    // Fetch agent from Supabase
    const { data: agentRow } = await supabase
      .from("agents")
      .select("*")
      .eq("agent_id", agentId)
      .eq("is_active", true)
      .single();

    if (!agentRow) {
      steps.push({
        agentId,
        agentName: `Agent #${agentId}`,
        input: currentInput,
        output: null,
        amountPaid: null,
        settlementId: null,
        latencyMs: 0,
        success: false,
        error: `Agent #${agentId} not found or inactive`,
      });
      break;
    }

    const agentPrice = Number(agentRow.price_per_call) / 1_000_000;
    if (agentPrice > remaining) {
      steps.push({
        agentId,
        agentName: agentRow.name,
        input: currentInput,
        output: null,
        amountPaid: null,
        settlementId: null,
        latencyMs: 0,
        success: false,
        error: `Price $${agentPrice.toFixed(6)} exceeds remaining budget $${remaining.toFixed(6)}`,
      });
      break;
    }

    const quillAgent: QuillAgent = {
      agentId: agentRow.agent_id,
      name: agentRow.name,
      description: agentRow.description ?? null,
      serviceUrl: agentRow.service_url,
      pricePerCall: BigInt(agentRow.price_per_call),
      priceFormatted: formatUSDC(BigInt(agentRow.price_per_call)),
      walletAddress: agentRow.wallet_address,
      tags: agentRow.tags ?? [],
      totalCalls: agentRow.total_calls ?? 0,
      totalRevenue: String(agentRow.total_revenue ?? "0"),
      successCount: agentRow.success_count ?? 0,
      successRate: (agentRow.total_calls ?? 0) > 0
        ? ((agentRow.success_count ?? 0) / agentRow.total_calls) * 100
        : null,
      stakeUSDC: Number(agentRow.stake_amount_usdc ?? 0),
    };

    const stepStart = Date.now();
    const callResult = await caller.call<{ result?: string; output?: string; answer?: string; text?: string }>(
      quillAgent,
      { prompt: currentInput, input: currentInput, task: currentInput }
    );
    const latencyMs = callResult.latencyMs ?? (Date.now() - stepStart);

    const output = extractOutput(callResult.data);

    if (callResult.success) {
      const paid = parseFloat(callResult.amountPaid ?? agentPrice.toFixed(6));
      remaining -= paid;
      totalSpent += paid;
      currentInput = output ?? currentInput; // chain: this step's output is next step's input

      steps.push({
        agentId,
        agentName: agentRow.name,
        input: currentInput,
        output,
        amountPaid: paid.toFixed(6),
        settlementId: callResult.settlementId ?? null,
        latencyMs,
        success: true,
        error: null,
      });
    } else {
      steps.push({
        agentId,
        agentName: agentRow.name,
        input: currentInput,
        output: null,
        amountPaid: null,
        settlementId: null,
        latencyMs,
        success: false,
        error: callResult.error ?? "Call failed",
      });
      break; // stop pipeline on failure
    }
  }

  const lastSuccessful = [...steps].reverse().find((s) => s.success);

  return {
    mode: "pipeline",
    steps,
    finalOutput: lastSuccessful?.output ?? null,
    totalSpentUSDC: totalSpent.toFixed(6),
    budgetRemaining: remaining.toFixed(6),
    success: steps.every((s) => s.success),
  };
}

function extractOutput(data: unknown): string | null {
  if (!data || typeof data !== "object") return typeof data === "string" ? data : null;
  const d = data as Record<string, unknown>;
  const val = d.result ?? d.output ?? d.answer ?? d.text ?? d.response ?? d.content;
  if (typeof val === "string") return val;
  if (val !== undefined) return JSON.stringify(val);
  return JSON.stringify(data);
}
