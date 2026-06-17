"use client";
import { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { StatusBadge } from "@/components/ui/Badge";
import { truncateAddress, relativeTime } from "@/lib/utils";

interface PaymentEvent {
  id: string;
  agent_id: number;
  amount_usdc: number;
  gateway_tx: string | null;
  status: string;
  created_at: string;
  endpoint: string;
}

const TH = {
  padding: "9px 14px",
  textAlign: "left" as const,
  color: "var(--color-text-muted)",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: "0.06em",
  borderBottom: "1px solid var(--color-border)",
};
const TD = { padding: "10px 14px", fontSize: 13, borderBottom: "1px solid var(--color-border-subtle)" };

export default function HistoryPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalSpent, setTotalSpent] = useState("0");
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/payments/history?wallet=${address}&limit=${LIMIT}&page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setPayments(data.payments ?? []);
        setTotal(data.total ?? 0);
        setTotalSpent(data.totalRevenue ?? "0");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, page]);

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, margin: "0 auto 20px", borderRadius: "50%", border: "2px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Call History</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: 24, fontSize: 14 }}>
          Connect your wallet to see your call history and spending.
        </p>
        <button
          onClick={() => connect({ connector: injected() })}
          style={{ fontSize: 14, fontWeight: 500, color: "#3b82f6", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 999, padding: "10px 28px", cursor: "pointer" }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>Call History</h1>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontFamily: "monospace" }}>{address}</span>
        </div>
        <Link href="/marketplace" style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none", fontWeight: 500 }}>← Marketplace</Link>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 28 }}>
        {[
          { label: "Total Calls", value: total.toLocaleString() },
          { label: "Total Spent", value: `$${parseFloat(totalSpent).toFixed(4)} USDC` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text)", fontFamily: "monospace" }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size="lg" />
        </div>
      ) : payments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-text-muted)" }}>
          <p style={{ marginBottom: 16 }}>No calls yet. Try an agent from the marketplace.</p>
          <Link href="/marketplace" style={{ color: "#3b82f6", textDecoration: "none", fontSize: 14 }}>Browse Agents →</Link>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Time", "Agent ID", "Amount", "Gateway TX", "Status"].map((h) => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ ...TD, color: "var(--color-text-secondary)" }}>{relativeTime(p.created_at)}</td>
                    <td style={TD}>
                      <Link href={`/agent/${p.agent_id}`} style={{ color: "#3b82f6", textDecoration: "none", fontFamily: "monospace", fontSize: 12 }}>
                        #{p.agent_id}
                      </Link>
                    </td>
                    <td style={{ ...TD, color: "#10b981", fontFamily: "monospace", fontWeight: 600 }}>
                      ${parseFloat(String(p.amount_usdc)).toFixed(6)}
                    </td>
                    <td style={TD}>
                      {p.gateway_tx ? (
                        <span style={{ color: "#7c3aed", fontFamily: "monospace", fontSize: 11 }}>
                          {truncateAddress(p.gateway_tx)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={TD}><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}
              >
                ← Prev
              </button>
              <span style={{ padding: "6px 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
                Page {page} of {Math.ceil(total / LIMIT)}
              </span>
              <button
                disabled={page >= Math.ceil(total / LIMIT)}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: page >= Math.ceil(total / LIMIT) ? "not-allowed" : "pointer", opacity: page >= Math.ceil(total / LIMIT) ? 0.5 : 1 }}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
