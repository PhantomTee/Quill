"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { CategoryBadge, PriceBadge, TagBadge, StatusBadge } from "@/components/ui/Badge";
import { truncateAddress, relativeTime } from "@/lib/utils";
import { USDC_ADDRESS, ARC_CHAIN_ID, GATEWAY_WALLET } from "@/lib/arc";

interface Agent {
  agent_id: number;
  name: string;
  description: string | null;
  service_url: string;
  price_per_call: number;
  wallet_address: string;
  owner_address: string;
  tags: string[];
  is_active: boolean;
  registered_at: string;
  total_calls: number;
  total_revenue: number;
  readme: string | null;
  tx_hash: string | null;
  example_request: Record<string, unknown> | null;
  example_response: Record<string, unknown> | null;
}

interface Payment {
  id: string;
  payer: string;
  amount_usdc: number;
  gateway_tx: string | null;
  created_at: string;
  status: string;
}

type CallState = "idle" | "awaiting_payment" | "calling" | "done" | "error";

interface Rating {
  avgRating: number | null;
  count: number;
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4, fontSize: 24 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          style={{ cursor: "pointer", color: i <= (hover || value) ? "#f59e0b" : "var(--color-border)", transition: "color 0.1s" }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: copied ? "#10b981" : "var(--color-text-secondary)", cursor: "pointer", flexShrink: 0 }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [callState, setCallState] = useState<CallState>("idle");
  const [requestBody, setRequestBody] = useState('{"prompt": "Hello, world!"}');
  const [callResult, setCallResult] = useState<{ response: string; latency: number; tx: string } | null>(null);
  const [callError, setCallError] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "payments" | "code" | "ratings">("overview");
  const [rating, setRating] = useState<Rating | null>(null);
  const [userStars, setUserStars] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingStatus, setRatingStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [ratingError, setRatingError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((data) => { setAgent(data.agent); setPayments(data.payments ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch(`/api/agents/${id}/rate`)
      .then((r) => r.json())
      .then(setRating)
      .catch(() => null);
  }, [id]);

  const submitRating = async (payer: string) => {
    if (!userStars) { setRatingError("Please select a star rating"); return; }
    setRatingStatus("submitting");
    setRatingError("");
    try {
      const res = await fetch(`/api/agents/${id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars: userStars, payer, comment: ratingComment }),
      });
      const data = await res.json();
      if (!res.ok) { setRatingError(data.error ?? "Failed to submit rating"); setRatingStatus("error"); return; }
      setRatingStatus("done");
      // Refresh rating
      fetch(`/api/agents/${id}/rate`).then((r) => r.json()).then(setRating).catch(() => null);
    } catch {
      setRatingError("Network error"); setRatingStatus("error");
    }
  };

  const handleCall = async () => {
    if (!agent) return;
    setCallState("calling");
    setCallError("");
    setCallResult(null);
    const start = Date.now();
    try {
      const res = await fetch(`/api/agents/${id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      if (res.status === 402) { setCallState("awaiting_payment"); return; }
      const text = await res.text();
      const latency = Date.now() - start;
      const paymentResponse = res.headers.get("PAYMENT-RESPONSE");
      let tx = "";
      if (paymentResponse) { try { tx = JSON.parse(atob(paymentResponse)).transaction ?? ""; } catch {} }
      setCallResult({ response: text, latency, tx });
      setCallState("done");
    } catch (e: unknown) {
      setCallError(e instanceof Error ? e.message : String(e));
      setCallState("error");
    }
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: "120px 0" }}><Spinner size="lg" /></div>;
  }

  if (!agent) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <h2 style={{ color: "var(--color-text)", fontSize: 22, marginBottom: 12 }}>Agent not found</h2>
        <p style={{ color: "var(--color-text-muted)", marginBottom: 20 }}>This agent may have been removed or the ID is incorrect.</p>
        <Link href="/marketplace" style={{ color: "#3b82f6", textDecoration: "none", fontSize: 13 }}>Back to Marketplace</Link>
      </div>
    );
  }

  const category = agent.tags[0]?.toUpperCase() ?? "CUSTOM";
  const priceUSDC = (agent.price_per_call / 1_000_000).toFixed(6);
  const registeredDate = new Date(agent.registered_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const tsSnippet = `import { GatewayClient } from "@circle-fin/x402-batching/client";

const gateway = new GatewayClient({
  chain: "arcTestnet",
  privateKey: process.env.BUYER_PRIVATE_KEY,
});

await gateway.deposit("1.00"); // fund once

const result = await gateway.pay(
  "${agent.service_url}",
  {
    method: "POST",
    body: JSON.stringify({ prompt: "Hello" }),
  }
);

console.log(await result.json());`;

  const curlSnippet = `# Step 1: Make the request (will return 402)
curl -X POST ${agent.service_url} \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Hello"}'

# Step 2: Pay ${priceUSDC} USDC to ${agent.wallet_address}
#         on Arc Testnet (chain ${ARC_CHAIN_ID})

# Step 3: Retry with payment signature
curl -X POST ${agent.service_url} \\
  -H "Content-Type: application/json" \\
  -H "X-Payment: <YOUR_BASE64_SIGNED_PAYLOAD>" \\
  -d '{"prompt": "Hello"}'`;

  const tabStyle = (tab: string) => ({
    padding: "9px 18px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer" as const,
    border: "none",
    background: "transparent",
    color: activeTab === tab ? "var(--color-text)" : "var(--color-text-muted)",
    borderBottom: activeTab === tab ? "2px solid #3b82f6" : "2px solid transparent",
    textTransform: "capitalize" as const,
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px 80px" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-muted)", marginBottom: 28 }}>
        <Link href="/marketplace" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Marketplace</Link>
        <span>/</span>
        <span style={{ color: "var(--color-text-secondary)" }}>{agent.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20, marginBottom: 32 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <CategoryBadge category={category} />
            {!agent.is_active && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>INACTIVE</span>
            )}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--color-text)", marginBottom: 10, lineHeight: 1.2 }}>{agent.name}</h1>
          <p style={{ fontSize: 15, color: "var(--color-text-secondary)", maxWidth: 580, lineHeight: 1.65 }}>{agent.description}</p>
          {agent.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
              {agent.tags.map((t) => <TagBadge key={t} tag={t} />)}
            </div>
          )}
        </div>

        {/* Price card */}
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "20px 22px", minWidth: 220 }}>
          <PriceBadge pricePerCall={agent.price_per_call} />
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            {[
              ["Total calls", agent.total_calls.toLocaleString()],
              ["Total earned", `$${parseFloat(String(agent.total_revenue)).toFixed(4)}`],
              ["Registered", registeredDate],
              ["Receiver", truncateAddress(agent.wallet_address)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                <span style={{ color: "var(--color-text)", fontFamily: "monospace", fontSize: 12 }}>{value}</span>
              </div>
            ))}
          </div>
          <Link
            href={`/playground?agent=${agent.agent_id}`}
            style={{ display: "block", textAlign: "center", marginTop: 16, fontSize: 13, fontWeight: 500, color: "white", background: "#3b82f6", borderRadius: 999, padding: "8px 0", textDecoration: "none" }}
          >
            Try in Playground
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--color-border)", marginBottom: 28 }}>
        {(["overview", "payments", "code", "ratings"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(tab)}>
            {tab === "ratings" && rating?.count ? `ratings (${rating.count})` : tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Service URL */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 10 }}>SERVICE ENDPOINT</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <code style={{ flex: 1, fontSize: 13, color: "var(--color-text)", fontFamily: "monospace", wordBreak: "break-all" }}>{agent.service_url}</code>
              <CopyButton text={agent.service_url} />
            </div>
          </div>

          {/* Try it */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 16 }}>TRY IT</div>

            {callState === "idle" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Request body (JSON)</label>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  style={{ minHeight: 90, resize: "vertical", fontFamily: "monospace", fontSize: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text)", outline: "none" }}
                />
                <button onClick={handleCall} style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 500, color: "white", background: "#3b82f6", border: "none", borderRadius: 999, padding: "8px 20px", cursor: "pointer" }}>
                  Send Request
                </button>
              </div>
            )}

            {callState === "calling" && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
                <Spinner />
                <span style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>Calling agent...</span>
              </div>
            )}

            {callState === "awaiting_payment" && (
              <div style={{ padding: 16, background: "rgba(59,130,246,0.06)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.18)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6", marginBottom: 8 }}>402 Payment Required</div>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10, lineHeight: 1.6 }}>
                  This agent requires <strong style={{ color: "var(--color-text)" }}>${priceUSDC} USDC</strong> paid to{" "}
                  <code style={{ fontFamily: "monospace", fontSize: 12, color: "#3b82f6" }}>{truncateAddress(agent.wallet_address)}</code> on Arc Testnet.
                  Use the Code tab for integration snippets.
                </p>
                <button onClick={() => setCallState("idle")} style={{ fontSize: 12, color: "var(--color-text-secondary)", background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Reset</button>
              </div>
            )}

            {callState === "done" && callResult && (
              <div>
                <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12, color: "var(--color-text-muted)" }}>
                  <span>Latency: <strong style={{ color: "#10b981" }}>{callResult.latency}ms</strong></span>
                  {callResult.tx && <span>Tx: <code style={{ fontFamily: "monospace", color: "#3b82f6" }}>{callResult.tx.slice(0, 16)}...</code></span>}
                </div>
                <pre style={{ fontSize: 12, lineHeight: 1.7, background: "var(--color-surface-alt)", borderRadius: 8, padding: 14, overflowX: "auto", color: "var(--color-text)", maxHeight: 280 }}>{callResult.response}</pre>
                <button onClick={() => setCallState("idle")} style={{ marginTop: 12, fontSize: 12, color: "var(--color-text-secondary)", background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Call Again</button>
              </div>
            )}

            {callState === "error" && (
              <div style={{ padding: 14, background: "rgba(239,68,68,0.06)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.18)" }}>
                <p style={{ color: "#ef4444", fontSize: 13 }}>{callError}</p>
                <button onClick={() => setCallState("idle")} style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-secondary)", background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}>Reset</button>
              </div>
            )}
          </div>

          {/* Example request/response */}
          {(agent.example_request || agent.example_response) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {agent.example_request && (
                <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 10 }}>EXAMPLE REQUEST</div>
                  <pre style={{ fontSize: 12, margin: 0, color: "var(--color-text)", overflowX: "auto", lineHeight: 1.7 }}>{JSON.stringify(agent.example_request, null, 2)}</pre>
                </div>
              )}
              {agent.example_response && (
                <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 10 }}>EXAMPLE RESPONSE</div>
                  <pre style={{ fontSize: 12, margin: 0, color: "var(--color-text)", overflowX: "auto", lineHeight: 1.7 }}>{JSON.stringify(agent.example_response, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {/* Readme */}
          {agent.readme && (
            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 22px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 14 }}>README</div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{agent.readme}</div>
            </div>
          )}

          {/* Meta */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              {[
                { label: "Owner", value: truncateAddress(agent.owner_address) },
                { label: "Payment Receiver", value: truncateAddress(agent.wallet_address) },
                { label: "Agent ID", value: `#${agent.agent_id}` },
                ...(agent.tx_hash ? [{ label: "Registration Tx", value: truncateAddress(agent.tx_hash), href: `https://testnet.arcscan.app/tx/${agent.tx_hash}` }] : []),
              ].map(({ label, value, href }: { label: string; value: string; href?: string }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>{label}</div>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontFamily: "monospace", color: "#3b82f6", textDecoration: "none" }}>{value}</a>
                  ) : (
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--color-text)" }}>{value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div>
          {payments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-muted)", fontSize: 14 }}>No payments recorded yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {["Time", "Payer", "Amount", "Gateway TX", "Status"].map((h) => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "var(--color-text-muted)", fontWeight: 600, fontSize: 11, letterSpacing: "0.06em" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <td style={{ padding: "10px 14px", color: "var(--color-text-muted)" }}>{relativeTime(p.created_at)}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--color-text-secondary)", fontSize: 12 }}>{truncateAddress(p.payer)}</td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "#10b981", fontWeight: 600 }}>${parseFloat(String(p.amount_usdc)).toFixed(6)}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {p.gateway_tx
                          ? <span style={{ fontFamily: "monospace", fontSize: 12, color: "#3b82f6" }}>{p.gateway_tx.slice(0, 16)}...</span>
                          : <span style={{ color: "var(--color-text-muted)" }}>-</span>}
                      </td>
                      <td style={{ padding: "10px 14px" }}><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ratings Tab */}
      {activeTab === "ratings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Summary */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 22px", display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: "var(--color-text)", fontFamily: "monospace", lineHeight: 1 }}>
                {rating?.avgRating ?? "—"}
              </div>
              <div style={{ fontSize: 20, color: "#f59e0b", marginTop: 4 }}>{"★".repeat(Math.round(rating?.avgRating ?? 0))}</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{rating?.count ?? 0} rating{rating?.count !== 1 ? "s" : ""}</div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)", width: 12 }}>{star}</span>
                  <span style={{ color: "#f59e0b", fontSize: 12 }}>★</span>
                  <div style={{ flex: 1, height: 6, background: "var(--color-border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: "50%", height: "100%", background: "#f59e0b", borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit rating */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 16 }}>RATE THIS AGENT</div>
            {ratingStatus === "done" ? (
              <div style={{ color: "#10b981", fontSize: 14, fontWeight: 500 }}>Thanks for your rating!</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <StarPicker value={userStars} onChange={setUserStars} />
                <textarea
                  placeholder="Leave a comment (optional)"
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  style={{ minHeight: 70, resize: "vertical", fontFamily: "inherit", fontSize: 13, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text)", outline: "none" }}
                />
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    id="rating-payer"
                    placeholder="Your wallet address (0x...)"
                    style={{ flex: 1, fontSize: 12, fontFamily: "monospace", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text)", outline: "none" }}
                  />
                  <button
                    disabled={ratingStatus === "submitting"}
                    onClick={() => {
                      const input = document.getElementById("rating-payer") as HTMLInputElement;
                      submitRating(input?.value ?? "");
                    }}
                    style={{ fontSize: 13, fontWeight: 500, color: "white", background: "#3b82f6", border: "none", borderRadius: 999, padding: "8px 20px", cursor: "pointer", opacity: ratingStatus === "submitting" ? 0.6 : 1 }}
                  >
                    {ratingStatus === "submitting" ? "Submitting…" : "Submit"}
                  </button>
                </div>
                {ratingError && <p style={{ color: "#ef4444", fontSize: 12 }}>{ratingError}</p>}
                <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>You must have a settled call to this agent to leave a rating.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code Tab */}
      {activeTab === "code" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 14 }}>TYPESCRIPT (Circle GatewayClient)</div>
            <pre style={{ fontSize: 12, lineHeight: 1.8, margin: 0, color: "var(--color-text)", overflowX: "auto" }}>{tsSnippet}</pre>
          </div>
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 14 }}>CURL</div>
            <pre style={{ fontSize: 12, lineHeight: 1.8, margin: 0, color: "var(--color-text)", overflowX: "auto" }}>{curlSnippet}</pre>
          </div>
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "20px 22px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.08em", marginBottom: 14 }}>PAYMENT DETAILS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, fontSize: 13 }}>
              {[
                ["Endpoint", agent.service_url],
                ["Price", `${priceUSDC} USDC`],
                ["USDC Contract", USDC_ADDRESS],
                ["Chain ID", String(ARC_CHAIN_ID)],
                ["Gateway Wallet", GATEWAY_WALLET],
                ["Payment Receiver", agent.wallet_address],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ color: "var(--color-text-muted)", marginBottom: 4, fontSize: 11 }}>{label}</div>
                  <div style={{ fontFamily: "monospace", color: "var(--color-text)", wordBreak: "break-all", fontSize: 12 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
