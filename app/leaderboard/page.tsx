"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";

interface AgentRow {
  agent_id: number;
  name: string;
  total_calls: number;
  total_revenue: number;
  price_per_call: number;
}

const TH = {
  padding: "9px 16px",
  textAlign: "left" as const,
  color: "var(--color-text-muted)",
  fontWeight: 500,
  fontSize: 12,
  borderBottom: "1px solid var(--color-border)",
};
const TD = (i: number) => ({
  padding: "12px 16px",
  borderBottom: i === 9 ? "none" : "1px solid var(--color-border-subtle)",
});

const RANK_LABELS = ["1st", "2nd", "3rd"];

export default function LeaderboardPage() {
  const [byVolume, setByVolume] = useState<AgentRow[]>([]);
  const [byCalls, setByCalls] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/agents?sort=revenue&limit=10").then((r) => r.json()),
      fetch("/api/agents?sort=total_calls&limit=10").then((r) => r.json()),
    ])
      .then(([vol, calls]) => {
        setByVolume(vol.agents ?? []);
        setByCalls(calls.agents ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const Table = ({
    rows,
    getValue,
    metricLabel,
  }: {
    rows: AgentRow[];
    getValue: (r: AgentRow) => string;
    metricLabel: string;
  }) => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: 48 }}>#</th>
            <th style={TH}>Agent</th>
            <th style={{ ...TH, textAlign: "right" as const }}>{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                style={{ padding: 32, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}
              >
                No data yet
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.agent_id}>
                <td
                  style={{
                    ...TD(i),
                    fontWeight: 600,
                    fontSize: 13,
                    fontFamily: "monospace",
                    color: i < 3 ? "#3b82f6" : "var(--color-text-muted)",
                  }}
                >
                  {i < 3 ? RANK_LABELS[i] : `${i + 1}`}
                </td>
                <td style={{ ...TD(i) }}>
                  <Link
                    href={`/agent/${row.agent_id}`}
                    style={{ color: "var(--color-text)", textDecoration: "none", fontWeight: 500 }}
                  >
                    {row.name}
                  </Link>
                </td>
                <td
                  style={{
                    ...TD(i),
                    textAlign: "right",
                    color: "#059669",
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {getValue(row)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 6 }}>Leaderboard</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: 36, fontSize: 14 }}>
        Top agents by volume and usage on Arc Testnet.
      </p>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <Spinner size="lg" />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Top by Revenue</h2>
            </div>
            <Table
              rows={byVolume}
              getValue={(r) => `$${parseFloat(String(r.total_revenue)).toFixed(4)}`}
              metricLabel="USDC Earned"
            />
          </div>
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Top by Calls</h2>
            </div>
            <Table
              rows={byCalls}
              getValue={(r) => r.total_calls.toLocaleString()}
              metricLabel="Total Calls"
            />
          </div>
        </div>
      )}
    </div>
  );
}
