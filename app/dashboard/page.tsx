"use client";
import { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { PriceBadge, StatusBadge } from "@/components/ui/Badge";
import { truncateAddress, relativeTime } from "@/lib/utils";

interface Agent {
  agent_id: number;
  name: string;
  price_per_call: number;
  total_calls: number;
  total_revenue: number;
  is_active: boolean;
  service_url: string;
}

interface Payment {
  id: string;
  agent_id: number;
  payer: string;
  amount_usdc: number;
  gateway_tx: string | null;
  created_at: string;
  status: string;
}

const TH = {
  padding: "9px 12px",
  textAlign: "left" as const,
  color: "var(--color-text-muted)",
  fontWeight: 500,
  fontSize: 12,
  borderBottom: "1px solid var(--color-border)",
};
const TD = { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid var(--color-border-subtle)" };

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/agents?ownerAddress=${address}`).then((r) => r.json()),
      fetch(`/api/payments/history?wallet=${address}&limit=30`).then((r) => r.json()),
    ])
      .then(([agentsData, paymentsData]) => {
        setAgents(agentsData.agents ?? []);
        setPayments(paymentsData.payments ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  const totalRevenue = agents.reduce((s, a) => s + parseFloat(String(a.total_revenue)), 0);
  const totalCalls = agents.reduce((s, a) => s + a.total_calls, 0);

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            margin: "0 auto 20px",
            borderRadius: "50%",
            border: "2px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            <line x1="12" y1="12" x2="12" y2="16" />
            <line x1="10" y1="14" x2="14" y2="14" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Agent Dashboard</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: 24, fontSize: 14 }}>
          Connect your wallet to see your agents and earnings.
        </p>
        <button
          onClick={() => connect({ connector: injected() })}
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#3b82f6",
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: 999,
            padding: "10px 28px",
            cursor: "pointer",
          }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>Dashboard</h1>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontFamily: "monospace" }}>{address}</span>
        </div>
        <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none", borderRadius: 8, fontSize: 13 }}>
          + Register Agent
        </Link>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          marginBottom: 36,
        }}
      >
        {[
          { label: "Agents", value: agents.length },
          { label: "Total Calls", value: totalCalls.toLocaleString() },
          { label: "Total Earned", value: `$${totalRevenue.toFixed(4)}` },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: "16px 20px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", fontFamily: "monospace" }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* My Agents */}
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text)", marginBottom: 14 }}>My Agents</h2>
          {agents.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 36, marginBottom: 32 }}>
              <p style={{ color: "var(--color-text-muted)", marginBottom: 16, fontSize: 14 }}>No agents registered yet.</p>
              <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none", borderRadius: 8 }}>
                Register Your First Agent
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
                marginBottom: 36,
              }}
            >
              {agents.map((agent) => (
                <div key={agent.agent_id} className="card" style={{ padding: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <Link href={`/agent/${agent.agent_id}`} style={{ textDecoration: "none" }}>
                      <h3 style={{ color: "var(--color-text)", fontWeight: 600, fontSize: 15 }}>{agent.name}</h3>
                    </Link>
                    <PriceBadge pricePerCall={agent.price_per_call} />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      fontSize: 13,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>Calls</div>
                      <div style={{ color: "var(--color-text)", fontWeight: 600, fontFamily: "monospace" }}>
                        {agent.total_calls.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>Earned</div>
                      <div style={{ color: "#059669", fontWeight: 600, fontFamily: "monospace" }}>
                        ${parseFloat(String(agent.total_revenue)).toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", wordBreak: "break-all" }}>
                    {agent.service_url}
                  </div>
                  {!agent.is_active && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#dc2626" }}>Inactive</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recent Payments */}
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text)", marginBottom: 14 }}>
            Recent Payments Received
          </h2>
          {payments.length === 0 ? (
            <div className="card" style={{ padding: 28 }}>
              <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
                No payments yet. They will appear here when callers use your agents.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Time", "Payer", "Amount", "Gateway TX", "Status"].map((h) => (
                      <th key={h} style={TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...TD, color: "var(--color-text-secondary)" }}>{relativeTime(p.created_at)}</td>
                      <td style={{ ...TD, color: "var(--color-text-code)", fontFamily: "monospace" }}>
                        {truncateAddress(p.payer)}
                      </td>
                      <td style={{ ...TD, color: "#059669", fontFamily: "monospace", fontWeight: 600 }}>
                        ${parseFloat(String(p.amount_usdc)).toFixed(6)}
                      </td>
                      <td style={TD}>
                        {p.gateway_tx ? (
                          <span style={{ color: "#7c3aed", fontFamily: "monospace", fontSize: 11 }}>
                            {p.gateway_tx.slice(0, 16)}…
                          </span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td style={TD}>
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
