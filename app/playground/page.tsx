"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { PriceBadge } from "@/components/ui/Badge";
import { ARC_CHAIN_ID, USDC_ADDRESS, GATEWAY_WALLET } from "@/lib/arc";

interface Agent {
  agent_id: number;
  name: string;
  description: string | null;
  service_url: string;
  price_per_call: number;
  wallet_address: string;
}

interface LogEntry {
  type: "request" | "response" | "payment" | "error" | "info";
  content: string;
  timestamp: number;
}

const LOG_COLORS: Record<string, string> = {
  request: "#2563eb",
  response: "#059669",
  payment: "#7c3aed",
  error: "#dc2626",
  info: "#6b7280",
};

function PlaygroundInner() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("agent");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [requestBody, setRequestBody] = useState('{"prompt": "Hello, world!"}');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    fetch("/api/agents?limit=50")
      .then((r) => r.json())
      .then((d) => {
        const list: Agent[] = d.agents ?? [];
        setAgents(list);
        if (preselectedId) {
          const match = list.find((a) => String(a.agent_id) === preselectedId);
          if (match) setSelected(match);
        }
      })
      .catch(() => {});
  }, [preselectedId]);

  const addLog = (type: LogEntry["type"], content: string) => {
    setLog((l) => [...l, { type, content, timestamp: Date.now() }]);
  };

  const handleCall = async () => {
    if (!selected) return;
    setCalling(true);
    setLog([]);
    const priceUSDC = (selected.price_per_call / 1_000_000).toFixed(6);
    addLog("info", `→ Calling ${selected.name} at ${selected.service_url}`);
    addLog("request", `POST ${selected.service_url}\nContent-Type: application/json\n\n${requestBody}`);
    try {
      const res = await fetch(`/api/agents/${selected.agent_id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      const paymentRequired = res.headers.get("PAYMENT-REQUIRED");
      const paymentResponse = res.headers.get("PAYMENT-RESPONSE");
      if (res.status === 402 && paymentRequired) {
        addLog("payment", `← 402 Payment Required\nPAYMENT-REQUIRED: [base64 encoded]\n\nDecoded:\n${JSON.stringify(JSON.parse(atob(paymentRequired)), null, 2)}`);
        addLog("info", `Required: ${priceUSDC} USDC → ${selected.wallet_address}\nChain: Arc Testnet (${ARC_CHAIN_ID})\nAsset: ${USDC_ADDRESS}\nGateway: ${GATEWAY_WALLET}`);
        addLog("info", "To proceed: use GatewayClient with your private key, or attach payment-signature header manually.");
      } else {
        const body = await res.text();
        if (paymentResponse) {
          addLog("payment", `← PAYMENT-RESPONSE:\n${JSON.stringify(JSON.parse(atob(paymentResponse)), null, 2)}`);
        }
        addLog("response", `← ${res.status} ${res.statusText}\nContent-Type: ${res.headers.get("Content-Type")}\n\n${body}`);
      }
    } catch (e: unknown) {
      addLog("error", `Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCalling(false);
    }
  };

  const curlCommand = selected
    ? `# Step 1 — probe (expect 402)\ncurl -X POST ${selected.service_url} \\\n  -H "Content-Type: application/json" \\\n  -d '${requestBody}'\n\n# Step 2 — pay & retry\ncurl -X POST ${selected.service_url} \\\n  -H "Content-Type: application/json" \\\n  -H "payment-signature: <BASE64_SIGNED_PAYLOAD>" \\\n  -d '${requestBody}'`
    : "";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>x402 Playground</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: 32, fontSize: 14 }}>
        Test any agent and see the full x402 payment lifecycle in a developer terminal view.
      </p>

      <div className="playground-grid" style={{ display: "grid", gridTemplateColumns: "clamp(200px, 25%, 260px) 1fr", gap: 16, alignItems: "start" }}>

        {/* Agent Selector */}
        <div className="card" style={{ padding: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-code)", marginBottom: 10 }}>Select Agent</h3>
          {agents.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No agents registered yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {agents.map((a) => (
                <button
                  key={a.agent_id}
                  onClick={() => setSelected(a)}
                  style={{
                    padding: "9px 11px",
                    borderRadius: 8,
                    border: `1px solid ${selected?.agent_id === a.agent_id ? "#3b82f6" : "var(--color-border)"}`,
                    background: selected?.agent_id === a.agent_id ? "rgba(59,130,246,0.06)" : "transparent",
                    color: "var(--color-text)",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: 13,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 4, color: "var(--color-text)" }}>{a.name}</div>
                  {a.description && (
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 5, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {a.description}
                    </div>
                  )}
                  <PriceBadge pricePerCall={a.price_per_call} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Request Input */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-code)" }}>Request Body</h3>
              {selected && <PriceBadge pricePerCall={selected.price_per_call} />}
            </div>
            <textarea
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              className="input mono"
              style={{ minHeight: 96, resize: "vertical", fontSize: 13 }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
              <button
                onClick={handleCall}
                disabled={!selected || calling}
                className="btn btn-primary"
                style={{ borderRadius: 8 }}
              >
                {calling
                  ? <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Spinner size="sm" /> Calling…</span>
                  : "Send Request"}
              </button>
              {!selected && <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Select an agent first</span>}
            </div>
          </div>

          {/* Terminal Log */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Terminal title bar */}
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--color-surface-alt)",
            }}>
              <div style={{ display: "flex", gap: 5 }}>
                {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace" }}>x402 terminal</span>
            </div>
            {/* Log output */}
            <div style={{
              padding: 16,
              minHeight: 280,
              maxHeight: 480,
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: 12,
              background: "var(--color-surface-alt)",
            }}>
              {log.length === 0 ? (
                <span style={{ color: "var(--color-text-muted)" }}>
                  {selected ? `Ready — press "Send Request" to call ${selected.name}.` : "Select an agent to begin."}
                </span>
              ) : (
                log.map((entry, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ color: "var(--color-text-muted)", fontSize: 10, marginBottom: 3 }}>
                      {new Date(entry.timestamp).toISOString().slice(11, 23)} [{entry.type.toUpperCase()}]
                    </div>
                    <pre style={{
                      color: LOG_COLORS[entry.type] ?? "#6b7280",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      lineHeight: 1.5,
                    }}>
                      {entry.content}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* cURL snippet */}
          {selected && (
            <div className="card">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-code)", marginBottom: 10 }}>cURL</h3>
              <pre style={{ overflowX: "auto", fontSize: 12, margin: 0 }}>{curlCommand}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", justifyContent: "center", padding: "120px 0" }}><Spinner size="lg" /></div>}>
      <PlaygroundInner />
    </Suspense>
  );
}
