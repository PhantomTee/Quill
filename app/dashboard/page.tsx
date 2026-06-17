"use client";
import { useState, useEffect } from "react";
import { useAccount, useConnect, useWalletClient } from "wagmi";
import { injected } from "wagmi/connectors";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { PriceBadge, StatusBadge } from "@/components/ui/Badge";
import { truncateAddress, relativeTime } from "@/lib/utils";
import { ERC20_ABI, USDC_ADDRESS } from "@/lib/arc";

interface Agent {
  agent_id: number;
  name: string;
  price_per_call: number;
  total_calls: number;
  total_revenue: number;
  success_count: number;
  unique_payers: number;
  stake_amount_usdc: number;
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

function MiniRevenueChart({ payments }: { payments: Payment[] }) {
  const now = Date.now();
  const days = 7;
  const buckets: number[] = Array(days).fill(0);

  for (const p of payments) {
    if (p.status !== "settled") continue;
    const age = (now - new Date(p.created_at).getTime()) / 86_400_000;
    const idx = Math.floor(age);
    if (idx >= 0 && idx < days) {
      buckets[days - 1 - idx] += parseFloat(String(p.amount_usdc));
    }
  }

  const maxVal = Math.max(...buckets, 0.000001);

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)", marginBottom: 12 }}>Revenue — last 7 days</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 56 }}>
        {buckets.map((v, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div
              title={`$${v.toFixed(4)} USDC`}
              style={{
                width: "100%",
                height: Math.max(3, (v / maxVal) * 52),
                background: i === days - 1 ? "#3b82f6" : "var(--color-border)",
                borderRadius: 3,
                transition: "height 0.4s ease",
                cursor: "default",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--color-text-muted)", marginTop: 6 }}>
        <span>7d ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function WithdrawPanel({ address }: { address: string }) {
  const { data: walletClient } = useWalletClient();
  const { address: connectedAddress } = useAccount();
  const [balance, setBalance] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawTo, setWithdrawTo] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch(`/api/withdraw?wallet=${address}`)
      .then((r) => r.json())
      .then((d) => setBalance(d.balanceUSDC ?? "0"))
      .catch(() => null);
  }, [address]);

  const handleWithdraw = async () => {
    if (!walletClient || !connectedAddress) return;
    const to = withdrawTo.trim() || connectedAddress;
    if (!/^0x[0-9a-f]{40}$/i.test(to)) { setError("Invalid address"); return; }
    if (!balance || parseFloat(balance) <= 0) { setError("No balance to withdraw"); return; }
    setWithdrawing(true); setError(""); setSuccess("");
    try {
      const amountRaw = BigInt(Math.floor(parseFloat(balance) * 1_000_000));
      await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to as `0x${string}`, amountRaw],
      });
      setSuccess(`Sent $${balance} USDC to ${truncateAddress(to)}`);
      setBalance("0");
      setShowForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px 20px", marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 10 }}>Withdraw Earnings</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          USDC balance: <span style={{ fontFamily: "monospace", color: "#059669", fontWeight: 600 }}>${balance ?? "…"}</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{ fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer" }}
        >
          {showForm ? "Cancel" : "Withdraw"}
        </button>
      </div>
      {showForm && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder={`Recipient (default: your wallet)`}
            value={withdrawTo}
            onChange={(e) => setWithdrawTo(e.target.value)}
            style={{ flex: 1, minWidth: 200, fontSize: 12, fontFamily: "monospace", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text)", outline: "none" }}
          />
          <button
            onClick={handleWithdraw}
            disabled={withdrawing}
            style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, border: "none", background: "#059669", color: "white", cursor: "pointer", opacity: withdrawing ? 0.7 : 1 }}
          >
            {withdrawing ? "Sending…" : `Send $${balance ?? "?"}`}
          </button>
        </div>
      )}
      {error && <p style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>{error}</p>}
      {success && <p style={{ marginTop: 6, fontSize: 12, color: "#059669" }}>{success}</p>}
      <p style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-muted)" }}>
        Transfers USDC directly from your wallet. Earnings are already in your wallet — this is a convenience transfer to another address.
      </p>
    </div>
  );
}

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
      fetch(`/api/payments/history?wallet=${address}&limit=50`).then((r) => r.json()),
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
  const totalSuccessCalls = agents.reduce((s, a) => s + (a.success_count ?? 0), 0);
  const globalSuccessRate = totalCalls > 0 ? ((totalSuccessCalls / totalCalls) * 100).toFixed(1) : "—";
  const totalUniquePayers = agents.reduce((s, a) => s + (a.unique_payers ?? 0), 0);

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 20px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, margin: "0 auto 20px", borderRadius: "50%", border: "2px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Agent Dashboard</h1>
        <p style={{ color: "var(--color-text-secondary)", marginBottom: 24, fontSize: 14 }}>
          Connect your wallet to see your agents and earnings.
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
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>Dashboard</h1>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontFamily: "monospace" }}>{address}</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/history" style={{ textDecoration: "none", fontSize: 13, color: "var(--color-text-secondary)", padding: "8px 16px", border: "1px solid var(--color-border)", borderRadius: 8 }}>
            Call History
          </Link>
          <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none", borderRadius: 8, fontSize: 13 }}>
            + Register Agent
          </Link>
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 28 }}>
        {[
          { label: "Agents", value: agents.length },
          { label: "Total Calls", value: totalCalls.toLocaleString() },
          { label: "Success Rate", value: `${globalSuccessRate}%` },
          { label: "Unique Payers", value: totalUniquePayers.toLocaleString() },
          { label: "Total Earned", value: `$${totalRevenue.toFixed(4)}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", fontFamily: "monospace" }}>{value}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      {payments.length > 0 && (
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
          <MiniRevenueChart payments={payments} />
        </div>
      )}

      {/* Withdraw */}
      {address && <WithdrawPanel address={address} />}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text)", marginBottom: 14 }}>My Agents</h2>
          {agents.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 36, marginBottom: 32 }}>
              <p style={{ color: "var(--color-text-muted)", marginBottom: 16, fontSize: 14 }}>No agents registered yet.</p>
              <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none", borderRadius: 8 }}>Register Your First Agent</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginBottom: 36 }}>
              {agents.map((agent) => {
                const sr = agent.total_calls > 0
                  ? ((agent.success_count ?? 0) / agent.total_calls * 100).toFixed(1)
                  : null;
                return (
                  <div key={agent.agent_id} className="card" style={{ padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <Link href={`/agent/${agent.agent_id}`} style={{ textDecoration: "none" }}>
                        <h3 style={{ color: "var(--color-text)", fontWeight: 600, fontSize: 15 }}>{agent.name}</h3>
                      </Link>
                      <PriceBadge pricePerCall={agent.price_per_call} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, marginBottom: 10 }}>
                      <div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>Calls</div>
                        <div style={{ color: "var(--color-text)", fontWeight: 600, fontFamily: "monospace" }}>{agent.total_calls.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>Earned</div>
                        <div style={{ color: "#059669", fontWeight: 600, fontFamily: "monospace" }}>${parseFloat(String(agent.total_revenue)).toFixed(4)}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>Success rate</div>
                        <div style={{ color: sr ? "#059669" : "var(--color-text-muted)", fontFamily: "monospace" }}>{sr ? `${sr}%` : "—"}</div>
                      </div>
                      <div>
                        <div style={{ color: "var(--color-text-muted)", fontSize: 11 }}>Unique payers</div>
                        <div style={{ color: "var(--color-text)", fontFamily: "monospace" }}>{agent.unique_payers ?? 0}</div>
                      </div>
                    </div>
                    {(agent.stake_amount_usdc > 0) && (
                      <div style={{ fontSize: 11, color: "#f59e0b", marginBottom: 8 }}>
                        🔒 ${parseFloat(String(agent.stake_amount_usdc)).toFixed(2)} staked
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", wordBreak: "break-all" }}>{agent.service_url}</div>
                    {!agent.is_active && <div style={{ marginTop: 8, fontSize: 11, color: "#dc2626" }}>Inactive</div>}
                  </div>
                );
              })}
            </div>
          )}

          <h2 style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text)", marginBottom: 14 }}>Recent Payments Received</h2>
          {payments.length === 0 ? (
            <div className="card" style={{ padding: 28 }}>
              <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No payments yet. They will appear here when callers use your agents.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Time", "Payer", "Amount", "Agent", "Status"].map((h) => (
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 30).map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...TD, color: "var(--color-text-secondary)" }}>{relativeTime(p.created_at)}</td>
                      <td style={{ ...TD, color: "var(--color-text-code)", fontFamily: "monospace" }}>{truncateAddress(p.payer)}</td>
                      <td style={{ ...TD, color: "#059669", fontFamily: "monospace", fontWeight: 600 }}>${parseFloat(String(p.amount_usdc)).toFixed(6)}</td>
                      <td style={TD}>
                        <Link href={`/agent/${p.agent_id}`} style={{ color: "#3b82f6", textDecoration: "none", fontSize: 12, fontFamily: "monospace" }}>
                          #{p.agent_id}
                        </Link>
                      </td>
                      <td style={TD}><StatusBadge status={p.status} /></td>
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
