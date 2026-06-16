"use client";

import { useState } from "react";

interface Subtask {
  capability: string;
  searchQuery: string;
  tags: string[];
}

interface AgentCandidate {
  agentId: number;
  name: string;
  description: string | null;
  priceFormatted: string;
  tags: string[];
  totalCalls: number;
}

interface TraceEntry {
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

interface RunResult {
  finalAnswer: string;
  totalSpentUSDC: string;
  budgetRemaining: string;
  trace: TraceEntry[];
  error?: string;
}

export default function AgentRunPage() {
  const [task, setTask] = useState("");
  const [budget, setBudget] = useState("0.005");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    if (!task.trim()) return;
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim(), budgetUSDC: budget }),
      });
      const data = await res.json() as RunResult;
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRunning(false);
    }
  }

  const budgetNum = parseFloat(budget) || 0;
  const spentNum = result ? parseFloat(result.totalSpentUSDC) : 0;
  const spentPct = budgetNum > 0 ? Math.min(100, (spentNum / budgetNum) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Autonomous Agent
          </h1>
          <p className="text-gray-400 text-sm">
            Describe any task. The agent plans subtasks, browses the marketplace, pays agents with real USDC on Arc Testnet, and synthesizes a final answer — all autonomously.
          </p>
        </div>

        {/* Input form */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-8">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Task
          </label>
          <textarea
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-none"
            rows={3}
            placeholder="Describe what you need the agent to do…"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />

          <div className="flex gap-4 items-end mt-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Budget (USDC)
              </label>
              <input
                type="number"
                step="0.001"
                min="0.0001"
                max="1"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <button
              onClick={handleRun}
              disabled={running || !task.trim()}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {running ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running…
                </>
              ) : "Run Agent"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">

            {/* Budget bar */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Spent: <span className="text-white font-mono">${result.totalSpentUSDC} USDC</span></span>
                <span>Remaining: <span className="text-white font-mono">${result.budgetRemaining} USDC</span></span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${spentPct}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1 text-right">
                {spentPct.toFixed(1)}% of ${budget} budget used
              </div>
            </div>

            {/* Decision trace */}
            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-4">
                Decision Trace
              </h2>
              <div className="space-y-4">
                {result.trace.map((entry, i) => (
                  <TraceCard key={i} entry={entry} index={i} />
                ))}
              </div>
            </div>

            {/* Final answer */}
            <div className="bg-gray-900 rounded-xl p-6 border border-indigo-800">
              <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">
                Final Answer
              </h2>
              <div className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">
                {result.finalAnswer}
              </div>
            </div>
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
      {/* Step header */}
      <button
        className="w-full flex items-start gap-3 px-5 py-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
          entry.skipped ? "bg-gray-700 text-gray-400" : "bg-indigo-600 text-white"
        }`}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-100">{entry.subtask.capability}</span>
            {entry.skipped ? (
              <span className="text-xs text-gray-500 bg-gray-800 rounded px-1.5 py-0.5">skipped</span>
            ) : (
              <>
                {entry.agentChosen && (
                  <span className="text-xs text-indigo-400 bg-indigo-950 border border-indigo-800 rounded px-1.5 py-0.5">
                    {entry.agentChosen}
                  </span>
                )}
                {entry.amountPaid && (
                  <span className="text-xs text-emerald-400 bg-emerald-950 border border-emerald-800 rounded px-1.5 py-0.5">
                    paid ${entry.amountPaid}
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{entry.llmReasoning}</p>
        </div>
        <span className="text-gray-600 text-xs mt-1">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4 space-y-4">

          {/* Candidates */}
          {entry.candidatesConsidered.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Candidates evaluated ({entry.candidatesConsidered.length})
              </p>
              <div className="space-y-1.5">
                {entry.candidatesConsidered.map((c) => (
                  <div
                    key={c.agentId}
                    className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
                      c.agentId === entry.agentId
                        ? "border-indigo-700 bg-indigo-950/50"
                        : "border-gray-800 bg-gray-800/40"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-200">{c.name}</span>
                      {c.agentId === entry.agentId && (
                        <span className="ml-2 text-indigo-400 font-semibold">← chosen</span>
                      )}
                      {c.description && (
                        <span className="text-gray-500 ml-1">— {c.description.slice(0, 80)}</span>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-gray-300 font-mono">${c.priceFormatted}</span>
                      <span className="text-gray-600 ml-1">({c.totalCalls} calls)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LLM reasoning */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              LLM Reasoning
              {entry.llmConfidence > 0 && (
                <span className="ml-2 text-gray-600 normal-case font-normal">
                  confidence {Math.round(entry.llmConfidence * 100)}%
                </span>
              )}
            </p>
            <p className="text-xs text-gray-300 leading-relaxed">{entry.llmReasoning}</p>
          </div>

          {/* Output */}
          {entry.output && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Agent Output</p>
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {entry.output}
              </div>
            </div>
          )}

          {/* Settlement */}
          {entry.settlementId && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Settlement tx:</span>
              <a
                href={`https://testnet.arcscan.app/tx/${entry.settlementId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 font-mono underline underline-offset-2 truncate"
              >
                {entry.settlementId.slice(0, 20)}…
              </a>
              <span className="text-gray-600">({entry.latencyMs}ms)</span>
            </div>
          )}

          {/* Skip reason */}
          {entry.skipped && entry.skipReason && (
            <p className="text-xs text-gray-500">
              <span className="text-gray-400 font-medium">Skip reason:</span> {entry.skipReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
