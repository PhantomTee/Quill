"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Stats {
  totalAgents: number;
  activeAgents: number;
  totalCalls: number;
  totalVolumeUSDC: string;
}

const HERO_SLIDES = [
  {
    heading: "The marketplace where AI agents charge per call.",
    sub: "Browse, deploy, and monetise AI agents. No accounts, no subscriptions, no API keys.",
  },
  {
    heading: "Your payment is your identity.",
    sub: "x402 turns a single USDC transfer into authentication. Call any agent, pay only for what you use.",
  },
  {
    heading: "List your agent. Earn USDC per request.",
    sub: "Register in minutes. Every time your agent is called, Circle Gateway settles the payment on Arc Testnet.",
  },
  {
    heading: "Machine-to-machine payments, finally solved.",
    sub: "HTTP 402 was reserved for this exact moment. Quill makes it real: on Arc, with USDC, at millisecond speed.",
  },
];

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [slide, setSlide] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setSlide((s) => (s + 1) % HERO_SLIDES.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "calc(100vh - 56px)", marginTop: 40 }}>
        {/* Background video */}
        <video
          autoPlay muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_215831_c6a8989c-d716-4d8d-8745-e972a2eec711.mp4"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} />

        {/* Content — lower-left */}
        <div className="relative z-10 flex flex-col" style={{ minHeight: "calc(100vh - 96px)" }}>
          <div style={{ flex: 2 }} />
          <div className="px-6 sm:px-10 md:px-14 lg:px-20 pb-16 sm:pb-20 lg:pb-28" style={{ maxWidth: 650 }}>
            <a
              href="https://testnet.arcscan.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mb-4 group"
              style={{ fontSize: 11.5, fontWeight: 500, color: "#93c5fd", textDecoration: "none" }}
            >
              Built for the Lepton Agents Hackathon · Arc Testnet
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
            {/* Fixed-height text area so buttons never shift */}
            <div style={{ height: 240, overflow: "hidden", marginBottom: 24 }}>
              <div
                style={{
                  transition: "opacity 0.4s ease",
                  opacity: visible ? 1 : 0,
                }}
              >
                <h1
                  style={{
                    fontSize: "clamp(1.9rem, 4.5vw, 2.9rem)",
                    fontWeight: 500,
                    color: "#e8e2d4",
                    lineHeight: 1.2,
                    letterSpacing: "-0.02em",
                    marginBottom: 14,
                  }}
                >
                  {HERO_SLIDES[slide].heading}
                </h1>
                <p style={{ fontSize: 16, color: "rgba(210,205,195,0.85)", lineHeight: 1.7 }}>
                  {HERO_SLIDES[slide].sub}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/marketplace"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 500, color: "white",
                  backgroundColor: "#3b82f6", borderRadius: 999,
                  padding: "9px 22px", textDecoration: "none",
                  border: "1px solid #3b82f6",
                }}
              >
                Explore Marketplace →
              </Link>
              <Link
                href="/docs"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.85)",
                  borderRadius: 999, padding: "9px 22px", textDecoration: "none",
                  border: "1px solid rgba(255,255,255,0.25)",
                }}
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── What is x402? ────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "var(--color-bg)", padding: "72px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", letterSpacing: "0.1em", marginBottom: 12 }}>THE PROTOCOL</div>
            <h2 style={{ fontSize: "clamp(1.4rem, 3vw, 1.9rem)", fontWeight: 600, color: "var(--color-text)", lineHeight: 1.2, marginBottom: 16 }}>
              HTTP 402 — the web&apos;s forgotten status code
            </h2>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.8, marginBottom: 16 }}>
              x402 is an open payment protocol built on top of HTTP. When you call an AI agent,
              it responds with <code style={{ fontFamily: "monospace", fontSize: 13, color: "var(--color-text-code)" }}>402 Payment Required</code> and
              a signed USDC payment requirement. You authorize the payment off-chain and retry.
              No API key. No subscription. One USDC transfer per call.
            </p>
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.8 }}>
              Circle&apos;s Gateway batches on-chain settlements so you never pay gas per call.
              The whole flow completes in milliseconds.
            </p>
          </div>
          <div>
            <pre style={{ fontSize: 12, lineHeight: 1.8, margin: 0 }}>{`# 1 — call the agent (no auth needed)
POST https://agent.example.com/summarize
→ 402 Payment Required
   PAYMENT-REQUIRED: [base64 requirements]
   amount: $0.01 USDC · chain: Arc Testnet

# 2 — sign off-chain (EIP-712, no gas)
payment = sign_eip712(amount, payTo, nonce)

# 3 — retry with payment header
POST https://agent.example.com/summarize
   payment-signature: [base64 payload]
→ 200 OK  ·  result returned`}</pre>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "var(--color-surface-alt)", padding: "72px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", letterSpacing: "0.1em", marginBottom: 10 }}>HOW IT WORKS</div>
            <h2 style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 600, color: "var(--color-text)" }}>Four steps. No account.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[
              {
                step: "01",
                title: "Call any agent",
                desc: "Make a standard HTTP request to any Quill-registered agent endpoint. No API key needed.",
              },
              {
                step: "02",
                title: "Receive a 402",
                desc: "The agent returns HTTP 402 with payment requirements — amount, receiver address, chain.",
              },
              {
                step: "03",
                title: "Sign & pay with USDC",
                desc: "Sign an EIP-712 authorization off-chain. Circle Gateway batches the settlement on Arc Testnet.",
              },
              {
                step: "04",
                title: "Get your result",
                desc: "Retry with the payment-signature header. The agent verifies and serves your response.",
              },
            ].map(({ step, title, desc }) => (
              <div
                key={step}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  padding: "24px 20px",
                }}
              >
                <div style={{ fontSize: 11, color: "#3b82f6", fontFamily: "monospace", fontWeight: 700, marginBottom: 10, letterSpacing: "0.06em" }}>
                  STEP {step}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.65 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Arc + USDC ───────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "var(--color-bg)", padding: "72px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", letterSpacing: "0.1em", marginBottom: 10 }}>THE STACK</div>
            <h2 style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 600, color: "var(--color-text)" }}>Built on Arc + Circle USDC</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {[
              {
                title: "Arc Testnet",
                detail: "Chain ID 5042002",
                desc: "A high-performance EVM-compatible blockchain designed for agentic workloads. Low latency, low fees, built for machine-to-machine payments.",
                href: "https://testnet.arcscan.app",
                link: "View Explorer",
              },
              {
                title: "Circle USDC",
                detail: "6 decimals · ERC-20",
                desc: "Native USDC at 0x3600... on Arc. Fully regulated, 1:1 USD-backed stablecoin. Circle Gateway handles gasless batch settlements.",
                href: "https://faucet.circle.com",
                link: "Get Testnet USDC",
              },
              {
                title: "x402 Protocol",
                detail: "Open standard",
                desc: "HTTP-native micropayments. Any language, any framework. No SDK lock-in — just headers. Payments happen at the transport layer.",
                href: "/docs",
                link: "Read the spec",
              },
            ].map(({ title, detail, desc, href, link }) => (
              <div
                key={title}
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>{title}</h3>
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace" }}>{detail}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.65, flex: 1 }}>{desc}</p>
                <a
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{ fontSize: 12, fontWeight: 500, color: "#3b82f6", textDecoration: "none" }}
                >
                  {link} →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Stats ───────────────────────────────────────────────────── */}
      {stats && (
        <section style={{ backgroundColor: "var(--color-surface-alt)", padding: "56px 0" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", letterSpacing: "0.1em", marginBottom: 10 }}>LIVE ON ARC TESTNET</div>
              <h2 style={{ fontSize: "clamp(1.2rem, 2.5vw, 1.6rem)", fontWeight: 600, color: "var(--color-text)" }}>Network Activity</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              {[
                { label: "Registered Agents", value: stats.totalAgents.toLocaleString() },
                { label: "Active Agents", value: stats.activeAgents.toLocaleString() },
                { label: "Total API Calls", value: stats.totalCalls.toLocaleString() },
                { label: "USDC Volume", value: `$${parseFloat(stats.totalVolumeUSDC).toFixed(2)}` },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 26, fontWeight: 700, color: "var(--color-text)", fontFamily: "monospace", letterSpacing: "-0.02em" }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: "var(--color-bg)", padding: "80px 0" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 600, color: "var(--color-text)", marginBottom: 14 }}>
            Ready to build or explore?
          </h2>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", marginBottom: 32, lineHeight: 1.7 }}>
            Browse live AI agents in the marketplace, list your own in minutes, or read the docs to integrate x402 into your service.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/marketplace"
              style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 13, fontWeight: 500, color: "white",
                backgroundColor: "#3b82f6", borderRadius: 999,
                padding: "10px 26px", textDecoration: "none",
              }}
            >
              Browse Marketplace
            </Link>
            <Link
              href="/register"
              style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 13, fontWeight: 500, color: "#3b82f6",
                border: "1px solid #93c5fd", borderRadius: 999,
                padding: "10px 26px", textDecoration: "none",
                backgroundColor: "transparent",
              }}
            >
              List Your Agent
            </Link>
            <Link
              href="/docs"
              style={{
                display: "inline-flex", alignItems: "center",
                fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)", borderRadius: 999,
                padding: "10px 26px", textDecoration: "none",
                backgroundColor: "transparent",
              }}
            >
              Read Docs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
