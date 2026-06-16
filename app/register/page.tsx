"use client";
import { useState } from "react";
import { useAccount, useConnect, useWalletClient } from "wagmi";
import { injected } from "wagmi/connectors";
import { Spinner } from "@/components/ui/Spinner";
import Link from "next/link";
import { REGISTRY_ABI, REGISTRY_ADDRESS } from "@/lib/arc";

type Step = 1 | 2 | 3 | 4 | 5;

interface FormData {
  name: string;
  description: string;
  tags: string;
  serviceUrl: string;
  pricePerCall: string;
  walletAddress: string;
  readme: string;
}

export default function RegisterPage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { data: walletClient } = useWalletClient();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>({
    name: "",
    description: "",
    tags: "",
    serviceUrl: "",
    pricePerCall: "0.001",
    walletAddress: "",
    readme: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ agentId: number; txHash: string } | null>(null);
  const [error, setError] = useState("");

  const handleField = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const useMyWallet = () => {
    if (address) setForm((f) => ({ ...f, walletAddress: address }));
  };

  const validateStep = (): string | null => {
    switch (step) {
      case 1:
        if (!form.name.trim()) return "Agent name is required.";
        if (!form.description.trim()) return "Description is required.";
        if (!form.serviceUrl.trim()) return "Service URL is required.";
        if (!/^https?:\/\/.+/.test(form.serviceUrl.trim())) return "Service URL must start with http:// or https://";
        return null;
      case 2:
        if (!form.pricePerCall || isNaN(parseFloat(form.pricePerCall)) || parseFloat(form.pricePerCall) <= 0)
          return "Enter a valid price greater than 0.";
        return null;
      case 4:
        if (!isConnected) return "Please connect your wallet first.";
        if (!form.walletAddress.trim()) return "Payment receiver address is required.";
        if (!/^0x[0-9a-fA-F]{40}$/.test(form.walletAddress.trim())) return "Enter a valid Ethereum address (0x...).";
        return null;
      default:
        return null;
    }
  };

  const nextStep = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => Math.min(5, s + 1) as Step);
  };
  const prevStep = () => { setError(""); setStep((s) => Math.max(1, s - 1) as Step); };

  const handleSubmit = async () => {
    if (!isConnected || !walletClient) {
      setError("Please connect your wallet first.");
      return;
    }
    if (!REGISTRY_ADDRESS) {
      setError("Registry contract not deployed. Add NEXT_PUBLIC_REGISTRY_ADDRESS to .env.local.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const priceAtomicUnits = BigInt(Math.round(parseFloat(form.pricePerCall) * 1_000_000));
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);

      // Call AgentRegistry.registerAgent() on-chain
      const txHash = await walletClient.writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: "registerAgent",
        args: [
          form.name,
          form.description,
          form.serviceUrl,
          priceAtomicUnits,
          (form.walletAddress || address) as `0x${string}`,
          tags,
        ],
      });

      // Record in Supabase via API
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          serviceUrl: form.serviceUrl,
          pricePerCall: form.pricePerCall,
          walletAddress: form.walletAddress || address,
          ownerAddress: address,
          tags,
          readme: form.readme || null,
          txHash,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");

      setResult({ agentId: data.agentId, txHash });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const PRICES = ["0.0001", "0.001", "0.01", "0.1"];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Register Your Agent</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: 40 }}>List your AI agent on Quill and start earning USDC per call.</p>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 40 }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600,
              background: step >= s ? "#3b82f6" : "rgba(0,0,0,0.07)",
              color: step >= s ? "white" : "#52525b",
            }}>{s}</div>
            {s < 5 && <div style={{ width: 40, height: 1, background: step > s ? "#3b82f6" : "rgba(0,0,0,0.1)" }} />}
          </div>
        ))}
        <div style={{ marginLeft: 12, fontSize: 13, color: "var(--color-text-secondary)", display: "flex", alignItems: "center" }}>
          {["Basic Info", "Pricing", "Capabilities", "Wallet", "Review"][step - 1]}
        </div>
      </div>

      {result ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 52, height: 52, margin: "0 auto 20px", borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "2px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>Agent Registered!</h2>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: 24 }}>Your agent is now live on Quill.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href={`/agent/${result.agentId}`} className="btn btn-primary" style={{ textDecoration: "none" }}>
              View Agent
            </Link>
            <a
              href={`https://testnet.arcscan.app/tx/${result.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              View TX
            </a>
          </div>
        </div>
      ) : (
        <div className="card">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 600 }}>Basic Information</h2>
              <div>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Agent Name *</label>
                <input className="input" value={form.name} onChange={handleField("name")} placeholder="e.g. Text Summarizer" maxLength={80} />
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{form.name.length}/80</div>
              </div>
              <div>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Description *</label>
                <textarea className="input" value={form.description} onChange={handleField("description")} placeholder="What does your agent do?" maxLength={1000} style={{ minHeight: 100, resize: "vertical" }} />
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{form.description.length}/1000</div>
              </div>
              <div>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Service URL *</label>
                <input className="input" value={form.serviceUrl} onChange={handleField("serviceUrl")} placeholder="https://my-agent.vercel.app/api/endpoint" />
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>Must be HTTPS for production</div>
              </div>
            </div>
          )}

          {/* Step 2: Pricing */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 600 }}>Pricing</h2>
              <div>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 10 }}>Price per call (USDC)</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  {PRICES.map((p) => (
                    <button key={p} onClick={() => setForm((f) => ({ ...f, pricePerCall: p }))}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: `1px solid ${form.pricePerCall === p ? "#3b82f6" : "rgba(0,0,0,0.1)"}`, background: form.pricePerCall === p ? "rgba(59,130,246,0.08)" : "white", color: form.pricePerCall === p ? "#2563eb" : "#6b7280" }}>
                      ${p}
                    </button>
                  ))}
                </div>
                <input className="input mono" value={form.pricePerCall} onChange={handleField("pricePerCall")} placeholder="0.001" type="number" min="0.000001" step="0.001" />
                <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 8 }}>
                  = {Math.round(parseFloat(form.pricePerCall || "0") * 1_000_000).toLocaleString()} USDC atomic units (6 decimals)
                </div>
              </div>
              <div className="card" style={{ background: "var(--color-surface-alt)" }}>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Revenue estimate</div>
                <div style={{ display: "flex", gap: 24, marginTop: 8, fontSize: 14 }}>
                  {[100, 1000, 10000].map((calls) => (
                    <div key={calls}>
                      <div style={{ color: "var(--color-text-muted)" }}>{calls.toLocaleString()} calls</div>
                      <div className="mono" style={{ color: "#059669" }}>${(calls * parseFloat(form.pricePerCall || "0")).toFixed(4)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Capabilities */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 600 }}>Capabilities & Tags</h2>
              <div>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Tags (comma-separated, up to 10)</label>
                <input className="input" value={form.tags} onChange={handleField("tags")} placeholder="nlp, summarization, english, text" />
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>First tag determines category. Use: nlp, code, data, image, audio, or custom</div>
              </div>
              <div>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Documentation / README (optional)</label>
                <textarea className="input mono" value={form.readme} onChange={handleField("readme")} placeholder="## Overview&#10;Your agent documentation..." style={{ minHeight: 150, resize: "vertical", fontSize: 13 }} />
              </div>
            </div>
          )}

          {/* Step 4: Wallet */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 600 }}>Payment Wallet</h2>
              {!isConnected ? (
                <div>
                  <p style={{ color: "var(--color-text-secondary)", marginBottom: 16 }}>Connect your wallet to sign the registration transaction.</p>
                  <button onClick={() => connect({ connector: injected() })} className="btn btn-primary">Connect Wallet</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 8, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 13, color: "#059669" }}>
                    Connected: <span className="mono">{address}</span>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Payment receiver address *</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input className="input mono" value={form.walletAddress} onChange={handleField("walletAddress")} placeholder="0x..." />
                      <button onClick={useMyWallet} className="btn btn-secondary" style={{ whiteSpace: "nowrap" }}>Use Mine</button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>This wallet receives USDC via Circle Gateway when callers pay your agent.</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Review & Submit */}
          {step === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={{ color: "var(--color-text)", fontSize: 18, fontWeight: 600 }}>Review & Register</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 14 }}>
                {[
                  ["Name", form.name],
                  ["Service URL", form.serviceUrl],
                  ["Price per call", `$${form.pricePerCall} USDC`],
                  ["Payment receiver", truncate(form.walletAddress || address || "")],
                  ["Tags", form.tags || "(none)"],
                  ["Owner", truncate(address || "")],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: 12, borderRadius: 8, background: "var(--color-surface-alt)" }}>
                    <div style={{ color: "var(--color-text-muted)", marginBottom: 4, fontSize: 12 }}>{label}</div>
                    <div className="mono" style={{ color: "var(--color-text)", wordBreak: "break-all" }}>{value}</div>
                  </div>
                ))}
              </div>

              <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary" style={{ padding: "12px 24px", fontSize: 15 }}>
                {submitting ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Spinner size="sm" /> Registering on Arc...</span> : "Sign & Register on Arc"}
              </button>
              {!REGISTRY_ADDRESS && (
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#d97706", fontSize: 13 }}>
                  Registry contract not deployed. Run: <code>npx hardhat run scripts/deploy.ts --network arc_testnet</code>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          {!result && (
            <div style={{ marginTop: 28 }}>
              {error && (
                <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626", fontSize: 13 }}>
                  {error}
                </div>
              )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={prevStep} disabled={step === 1} className="btn btn-outline">
                ← Back
              </button>
              {step < 5 ? (
                <button onClick={nextStep} className="btn btn-primary">
                  Continue →
                </button>
              ) : null}
            </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function truncate(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 20) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
}
