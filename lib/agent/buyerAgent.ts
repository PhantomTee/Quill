import { AgentCaller } from "../../sdk/AgentCaller";
import type { QuillAgent } from "../../sdk/types";
import {
  planTask,
  evaluateCandidates,
  synthesize,
  type Subtask,
  type AgentCandidate,
  type SubtaskResult,
} from "../groq";

export interface TraceEntry {
  subtask: Subtask;
  candidatesConsidered: AgentCandidate[];
  agentChosen: string | null;
  agentId: number | null;
  llmReasoning: string;
  llmConfidence: number;
  amountPaid: string | null;
  settlementId: string | null;
  latencyMs: number;
  output: string | null;
  skipped: boolean;
  skipReason: string | null;
}

export interface AgentRunResult {
  finalAnswer: string;
  totalSpentUSDC: string;
  budgetRemaining: string;
  trace: TraceEntry[];
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export class QuillBuyerAgent {
  private caller: AgentCaller;

  constructor(privateKey: `0x${string}`) {
    this.caller = new AgentCaller({ privateKey });
  }

  async run(task: string, budgetUSDC: string): Promise<AgentRunResult> {
    let remaining = parseFloat(budgetUSDC);
    if (isNaN(remaining) || remaining <= 0) throw new Error("Invalid budgetUSDC");

    const subtasks = await planTask(task);
    const trace: TraceEntry[] = [];
    const subtaskResults: SubtaskResult[] = [];
    let totalSpent = 0;
    let previousOutput: string | null = null;

    for (const subtask of subtasks) {
      if (remaining <= 0) {
        trace.push(buildSkippedEntry(subtask, [], "Budget exhausted"));
        subtaskResults.push({ subtask, output: "", agentId: null, agentName: null });
        continue;
      }

      const stepStart = Date.now();

      // Discovery: find agents matching this subtask within remaining budget
      const params = new URLSearchParams({
        q: subtask.searchQuery,
        maxPrice: String(Math.floor(remaining * 1_000_000)),
        limit: "5",
      });
      if (subtask.tags.length > 0) params.set("tag", subtask.tags[0]);

      let agents: QuillAgent[] = [];
      try {
        const res = await fetch(`${APP_URL}/api/agents?${params}`);
        const json = await res.json() as { agents?: Record<string, unknown>[] };
        agents = (json.agents ?? []).map((a) => {
          const totalCalls = (a.total_calls ?? 0) as number;
          const successCount = (a.success_count ?? 0) as number;
          return {
            agentId: a.agent_id as number,
            name: a.name as string,
            description: (a.description ?? null) as string | null,
            serviceUrl: a.service_url as string,
            pricePerCall: BigInt(String(a.price_per_call)),
            priceFormatted: (Number(a.price_per_call) / 1_000_000).toFixed(6),
            walletAddress: a.wallet_address as string,
            tags: (a.tags ?? []) as string[],
            totalCalls,
            totalRevenue: String(a.total_revenue ?? "0"),
            successCount,
            successRate: totalCalls > 0 ? (successCount / totalCalls) * 100 : null,
            stakeUSDC: Number(a.stake_amount_usdc ?? 0),
          };
        });
      } catch {
        trace.push(buildSkippedEntry(subtask, [], "Discovery failed"));
        subtaskResults.push({ subtask, output: "", agentId: null, agentName: null });
        continue;
      }

      const candidates: AgentCandidate[] = agents.map((a) => ({
        agentId: a.agentId,
        name: a.name,
        description: a.description,
        priceFormatted: a.priceFormatted,
        tags: a.tags,
        totalCalls: a.totalCalls,
        successRate: a.successRate,
        stakeUSDC: a.stakeUSDC,
      }));

      // LLM evaluation: pick the best agent (or skip)
      const evaluation = await evaluateCandidates(subtask, candidates, remaining.toFixed(6));

      if (evaluation.chosenAgentId === null) {
        const entry = buildSkippedEntry(subtask, candidates, evaluation.reasoning, evaluation.confidence);
        trace.push(entry);
        subtaskResults.push({ subtask, output: "", agentId: null, agentName: null });
        continue;
      }

      const chosenAgent = agents.find((a) => a.agentId === evaluation.chosenAgentId);
      if (!chosenAgent) {
        trace.push(buildSkippedEntry(subtask, candidates, "Chosen agent not found in results", evaluation.confidence));
        subtaskResults.push({ subtask, output: "", agentId: null, agentName: null });
        continue;
      }

      const agentPrice = Number(chosenAgent.pricePerCall) / 1_000_000;

      // Hard budget check
      if (agentPrice > remaining) {
        trace.push({
          ...buildSkippedEntry(subtask, candidates, `Price $${agentPrice.toFixed(6)} exceeds remaining budget $${remaining.toFixed(6)}`, evaluation.confidence),
          agentChosen: chosenAgent.name,
          agentId: chosenAgent.agentId,
          llmReasoning: evaluation.reasoning,
        });
        subtaskResults.push({ subtask, output: "", agentId: null, agentName: null });
        continue;
      }

      // Build call body — chain previous output if available
      const callBody: Record<string, string> = { task: subtask.capability };
      if (previousOutput) callBody.context = previousOutput;

      // Make the real x402 call
      const result = await this.caller.call<{ result?: string; output?: string; answer?: string; text?: string }>(
        chosenAgent,
        callBody
      );

      const latencyMs = result.latencyMs ?? (Date.now() - stepStart);
      const output = extractOutput(result.data) ?? "";

      if (result.success) {
        const paid = parseFloat(result.amountPaid ?? agentPrice.toFixed(6));
        remaining -= paid;
        totalSpent += paid;
        previousOutput = output;

        trace.push({
          subtask,
          candidatesConsidered: candidates,
          agentChosen: chosenAgent.name,
          agentId: chosenAgent.agentId,
          llmReasoning: evaluation.reasoning,
          llmConfidence: evaluation.confidence,
          amountPaid: paid.toFixed(6),
          settlementId: result.settlementId ?? null,
          latencyMs,
          output,
          skipped: false,
          skipReason: null,
        });

        subtaskResults.push({
          subtask,
          output,
          agentId: chosenAgent.agentId,
          agentName: chosenAgent.name,
        });
      } else {
        trace.push({
          subtask,
          candidatesConsidered: candidates,
          agentChosen: chosenAgent.name,
          agentId: chosenAgent.agentId,
          llmReasoning: evaluation.reasoning,
          llmConfidence: evaluation.confidence,
          amountPaid: null,
          settlementId: null,
          latencyMs,
          output: null,
          skipped: true,
          skipReason: `Call failed: ${result.error}`,
        });

        subtaskResults.push({ subtask, output: result.error ?? "", agentId: null, agentName: null });
      }
    }

    const finalAnswer = await synthesize(task, subtaskResults);

    return {
      finalAnswer,
      totalSpentUSDC: totalSpent.toFixed(6),
      budgetRemaining: remaining.toFixed(6),
      trace,
    };
  }
}

function buildSkippedEntry(
  subtask: Subtask,
  candidates: AgentCandidate[],
  reason: string,
  confidence = 1
): TraceEntry {
  return {
    subtask,
    candidatesConsidered: candidates,
    agentChosen: null,
    agentId: null,
    llmReasoning: reason,
    llmConfidence: confidence,
    amountPaid: null,
    settlementId: null,
    latencyMs: 0,
    output: null,
    skipped: true,
    skipReason: reason,
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
