"use client";

import { useState } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subtask { capability: string; searchQuery: string; tags: string[] }
interface AgentCandidate {
  agentId: number; name: string; description: string | null;
  priceFormatted: string; tags: string[]; totalCalls: number;
  successRate: number | null; stakeUSDC: number;
}
interface TraceEntry {
  subtask: Subtask; candidatesConsidered: AgentCandidate[];
  agentChosen: string | null; agentId: number | null;
  llmReasoning: string; llmConfidence: number;
  amountPaid: string | null; settlementId: string | null;
  latencyMs: number; output: string | null;
  skipped: boolean; skipReason: string | null;
}
interface AutonomousResult {
  finalAnswer: string; totalSpentUSDC: string;
  budgetRemaining: string; trace: TraceEntry[];
}

interface PipelineStep {
  agentId: number; agentName: string; input: string;
  output: string | null; amountPaid: string | null;
  settlementId: string | null; latencyMs: number;
  success: boolean; error: string | null;
}
interface PipelineResult {
  mode: "pipeline"; steps: PipelineStep[];
  finalOutput: string | null; totalSpentUSDC: string;
  budgetRemaining: string; success: boolean;
}

type Mode = "autonomous" | "pipeline";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentRunPage() {
  const [mode, setMode] = useState<Mode>("autonomous");

  // Autonomous state
  const [task, setTask] = useState("");
  const [budget, setBudget] = useState("0.005");
  const [autonomousResult, setAutonomousResult] = useState<AutonomousResult | null>(null);

  // Pipeline state
  const [pipelineIds, setPipelineIds] = useState<string>(""); // comma-separated agent IDs
  const [pipelineInput, setPipelineInput] = useState("");
  const [pipelineBudget, setPipelineBudget] = useState("0.01");
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAutonomous() {
    if (!task.trim()) return;
    setRunning(true); setError(null); setAutonomousResult(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim(), budgetUSDC: budget }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else setAutonomousResult(data as AutonomousResult);
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setRunning(false); }
  }

  async function handlePipeline() {
    const ids = pipelineIds.split(/[\s,]+/).map(Number).filter((n) => n > 0);
    if (ids.length === 0 || !pipelineInput.trim()) return;
    setRunning(true); setError(null); setPipelineResult(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline: ids, input: pipelineInput.trim(), budgetUSDC: pipelineBudget }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else setPipelineResult(data as PipelineResult);
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setRunning(false); }
  }

  const budgetNum = parseFloat(mode === "autonomous" ? budget : pipelineBudget) || 0;
  const spentNum = autonomousResult ? parseFloat(autonomousResult.totalSpentUSDC)
    : pipelineResult ? parseFloat(pipelineResult.totalSpentUSDC) : 0;
  const spentPct = budgetNum > 0 ? Math.min(100, (spentNum / budgetNum) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Autonomous Agent</h1>
          <p className="text-gray-400 text-sm">
            Plan a task autonomously, or run a fixed pipeline of agents that chain output → input.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-900 rounded-lg w-fit border border-gray-800">
          {(["autonomous", "pipeline"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`px-5 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                mode === m
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {m === "pipeline" ? "⛓ Pipeline" : "⚡ Autonomous"}
            </button>
          ))}
        </div>

        {/* ── Autonomous form ── */}
        {mode === "autonomous" && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Task</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
              rows={3}
              placeholder="Describe what you need the agent to do…"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
            <div className="flex gap-4 items-end mt-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Budget (USDC)</label>
                <input
                  type="number" step="0.001" min="0.0001" max="1"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                  value={budget} onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <button
                onClick={handleAutonomous} disabled={running || !task.trim()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {running ? <><Spinner /> Running…</> : "Run Agent"}
              </button>
            </div>
          </div>
        )}

        {/* ── Pipeline form ── */}
        {mode === "pipeline" && (
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Agent IDs <span className="text-gray-600 normal-case font-normal">(comma-separated, in order)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1, 3, 5"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 font-mono placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                value={pipelineIds} onChange={(e) => setPipelineIds(e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1.5">
                Each agent's output is passed as input to the next.{" "}
                <Link href="/marketplace" className="text-indigo-500 hover:text-indigo-400">Browse agents →</Link>
              </p>
            </div>

            {/* Preview pill chain */}
            {pipelineIds.trim() && (
              <div className="flex items-center gap-2 flex-wrap mb-5">
                {pipelineIds.split(/[\s,]+/).filter(Boolean).map((id, i, arr) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-mono">
                      Agent #{id}
                    </span>
                    {i < arr.length - 1 && <span className="text-gray-600 text-xs">→</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Initial Input</label>
              <textarea
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
                placeholder="Prompt passed to the first agent in the chain…"
                value={pipelineInput} onChange={(e) => setPipelineInput(e.target.value)}
              />
            </div>

            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Budget (USDC)</label>
                <input
                  type="number" step="0.001" min="0.0001" max="2"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                  value={pipelineBudget} onChange={(e) => setPipelineBudget(e.target.value)}
                />
              </div>
              <button
                onClick={handlePipeline}
                disabled={running || !pipelineInput.trim() || !pipelineIds.trim()}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {running ? <><Spinner /> Running…</> : "Run Pipeline"}
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {/* ── Autonomous results ── */}
        {autonomousResult && mode === "autonomous" && (
          <div className="space-y-6">
            <BudgetBar spent={autonomousResult.totalSpentUSDC} remaining={autonomousResult.budgetRemaining} pct={spentPct} budget={budget} />
            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-4">Decision Trace</h2>
              <div className="space-y-4">
                {autonomousResult.trace.map((entry, i) => (
                  <TraceCard key={i} entry={entry} index={i} />
                ))}
              </div>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-indigo-800">
              <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Final Answer</h2>
              <div className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{autonomousResult.finalAnswer}</div>
            </div>
          </div>
        )}

        {/* ── Pipeline results ── */}
        {pipelineResult && mode === "pipeline" && (
          <div className="space-y-6">
            <BudgetBar spent={pipelineResult.totalSpentUSDC} remaining={pipelineResult.budgetRemaining} pct={spentPct} budget={pipelineBudget} />
            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-4">
                Pipeline Steps
                <span className={`ml-3 text-xs font-normal normal-case ${pipelineResult.success ? "text-emerald-400" : "text-red-400"}`}>
                  {pipelineResult.success ? "All steps succeeded" : "Pipeline stopped early"}
                </span>
              </h2>
              <div className="space-y-3">
                {pipelineResult.steps.map((step, i) => (
                  <PipelineStepCard key={i} step={step} index={i} total={pipelineResult.steps.length} />
                ))}
              </div>
            </div>
            {pipelineResult.finalOutput && (
              <div className="bg-gray-900 rounded-xl p-6 border border-indigo-800">
                <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Final Output</h2>
                <div className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{pipelineResult.finalOutput}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}

function BudgetBar({ spent, remaining, pct, budget }: { spent: string; remaining: string; pct: number; budget: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>Spent: <span className="text-white font-mono">${spent} USDC</span></span>
        <span>Remaining: <span className="text-white font-mono">${remaining} USDC</span></span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-gray-500 mt-1 text-right">{pct.toFixed(1)}% of ${budget} budget used</div>
    </div>
  );
}

function PipelineStepCard({ step, index, total }: { step: PipelineStep; index: number; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const isLast = index === total - 1;

  return (
    <div className="relative">
      {!isLast && (
        <div className="absolute left-6 top-full h-3 w-0.5 bg-gray-800 z-10" />
      )}
      <div className={`rounded-xl border ${step.success ? "border-gray-700 bg-gray-900" : "border-red-900/50 bg-red-950/20"}`}>
        <button className="w-full flex items-start gap-3 px-5 py-4 text-left" onClick={() => setExpanded(!expanded)}>
          <span className={`mt-0.5 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step.success ? "bg-indigo-600 text-white" : "bg-red-700 text-white"
          }`}>
            {step.success ? "✓" : "✗"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-100">#{step.agentId} {step.agentName}</span>
              {step.amountPaid && (
                <span className="text-xs text-emerald-400 bg-emerald-950 border border-emerald-800 rounded px-1.5 py-0.5">
                  paid ${step.amountPaid}
                </span>
              )}
              {step.latencyMs > 0 && (
                <span className="text-xs text-gray-600">{step.latencyMs}ms</span>
              )}
            </div>
            {!step.success && step.error && (
              <p className="text-xs text-red-400 mt-1">{step.error}</p>
            )}
            {step.success && step.output && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{step.output}</p>
            )}
          </div>
          <span className="text-gray-600 text-xs mt-1">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Input</p>
              <div className="bg-gray-800 rounded px-3 py-2 text-xs text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto">{step.input}</div>
            </div>
            {step.output && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Output → next step</p>
                <div className="bg-gray-800 rounded px-3 py-2 text-xs text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">{step.output}</div>
              </div>
            )}
            {step.settlementId && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Settlement tx:</span>
                <a href={`https://testnet.arcscan.app/tx/${step.settlementId}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-mono underline">
                  {step.settlementId.slice(0, 20)}…
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TraceCard({ entry, index }: { entry: TraceEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-xl border ${entry.skipped ? "border-gray-700 bg-gray-900/50" : "border-gray-700 bg-gray-900"}`}>
      <button className="w-full flex items-start gap-3 px-5 py-4 text-left" onClick={() => setExpanded(!expanded)}>
        <span className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
          entry.skipped ? "bg-gray-700 text-gray-400" : "bg-indigo-600 text-white"
        }`}>{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-100">{entry.subtask.capability}</span>
            {entry.skipped ? (
              <span className="text-xs text-gray-500 bg-gray-800 rounded px-1.5 py-0.5">skipped</span>
            ) : (
              <>
                {entry.agentChosen && <span className="text-xs text-indigo-400 bg-indigo-950 border border-indigo-800 rounded px-1.5 py-0.5">{entry.agentChosen}</span>}
                {entry.amountPaid && <span className="text-xs text-emerald-400 bg-emerald-950 border border-emerald-800 rounded px-1.5 py-0.5">paid ${entry.amountPaid}</span>}
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{entry.llmReasoning}</p>
        </div>
        <span className="text-gray-600 text-xs mt-1">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">
          {entry.candidatesConsidered.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Candidates ({entry.candidatesConsidered.length})</p>
              <div className="space-y-1.5">
                {entry.candidatesConsidered.map((c) => (
                  <div key={c.agentId} className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${c.agentId === entry.agentId ? "border-indigo-700 bg-indigo-950/50" : "border-gray-800 bg-gray-800/40"}`}>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-200">{c.name}</span>
                      {c.agentId === entry.agentId && <span className="ml-2 text-indigo-400 font-semibold">← chosen</span>}
                      {c.description && <span className="text-gray-500 ml-1">— {c.description.slice(0, 80)}</span>}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div>
                        <span className="text-gray-300 font-mono">${c.priceFormatted}</span>
                        <span className="text-gray-600 ml-1">({c.totalCalls} calls)</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 justify-end">
                        {c.successRate === null ? (
                          <span className="text-gray-600">unproven</span>
                        ) : (
                          <span className={c.successRate >= 90 ? "text-emerald-400" : c.successRate >= 70 ? "text-amber-400" : "text-red-400"}>
                            {c.successRate.toFixed(0)}% success
                          </span>
                        )}
                        {c.stakeUSDC > 0 && (
                          <span className="text-indigo-300">🔒 ${c.stakeUSDC.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              LLM Reasoning
              {entry.llmConfidence > 0 && <span className="ml-2 text-gray-600 normal-case font-normal">confidence {Math.round(entry.llmConfidence * 100)}%</span>}
            </p>
            <p className="text-xs text-gray-300 leading-relaxed">{entry.llmReasoning}</p>
          </div>
          {entry.output && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Agent Output</p>
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">{entry.output}</div>
            </div>
          )}
          {entry.settlementId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Settlement tx:</span>
              <a href={`https://testnet.arcscan.app/tx/${entry.settlementId}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 font-mono underline">{entry.settlementId.slice(0, 20)}…</a>
              <span className="text-gray-600">({entry.latencyMs}ms)</span>
            </div>
          )}
          {entry.skipped && entry.skipReason && (
            <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Skip reason:</span> {entry.skipReason}</p>
          )}
        </div>
      )}
    </div>
  );
}
