"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useConnectors } from "wagmi";
import { truncateAddress } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const NAV = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/agent-run", label: "Run Agents" },
  { href: "/register", label: "List Agent" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/docs", label: "Docs" },
];

function QuillLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 256 256" fill="none">
      <path
        fill="currentColor"
        d="M 160 88 L 194 34 L 216 0 L 256 0 L 256 40 L 221.5 93.5 L 200 128 L 256 128 L 256 256 L 96 256 L 96 168 L 64.246 220 L 40 256 L 0 256 L 0 216 L 34 162 L 56 128 L 0 128 L 0 0 L 160 0 Z"
      />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const connectors = useConnectors();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleConnect = () => {
    const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];
    if (injectedConnector) connect({ connector: injectedConnector });
  };

  return (
    <header
      style={{
        background: "var(--color-bg)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 20px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            flexShrink: 0,
            color: "var(--color-text)",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: "50%",
              backgroundColor: "var(--color-pill)",
              color: "var(--color-text-secondary)",
            }}
          >
            <QuillLogo />
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Quill</span>
        </Link>

        {/* Desktop nav — hidden below lg */}
        <nav
          style={{ alignItems: "center", gap: 4, flex: 1, justifyContent: "center" }}
          className="hidden lg:flex"
        >
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                padding: "5px 12px",
                borderRadius: 8,
                color: pathname === href ? "var(--color-text)" : "var(--color-text-secondary)",
                background: pathname === href ? "var(--color-border)" : "transparent",
                transition: "all 0.15s",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side: wallet + theme toggle + hamburger */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Wallet button — desktop only */}
          <div className="hidden lg:flex" style={{ alignItems: "center" }}>
            {isConnected && address ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    fontFamily: "monospace",
                    backgroundColor: "var(--color-pill)",
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {truncateAddress(address)}
                </span>
                <button
                  onClick={() => disconnect()}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    background: "transparent",
                    border: "1px solid var(--color-border)",
                    borderRadius: 999,
                    padding: "4px 12px",
                    cursor: "pointer",
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect()}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#3b82f6",
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  borderRadius: 999,
                  padding: "6px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Hamburger — below lg only */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex lg:hidden"
            style={{
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-pill)",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              flexShrink: 0,
            }}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile/tablet menu drawer — absolute overlay */}
      {menuOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 100,
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            padding: "12px 20px 20px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
          className="lg:hidden"
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  textDecoration: "none",
                  padding: "10px 12px",
                  borderRadius: 8,
                  color: pathname === href ? "var(--color-text)" : "var(--color-text-secondary)",
                  background: pathname === href ? "var(--color-border)" : "transparent",
                }}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile wallet */}
          <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
            {isConnected && address ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                    fontFamily: "monospace",
                    backgroundColor: "var(--color-pill)",
                    padding: "8px 12px",
                    borderRadius: 8,
                    wordBreak: "break-all",
                  }}
                >
                  {address}
                </span>
                <button
                  onClick={() => { disconnect(); setMenuOpen(false); }}
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    background: "transparent",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    padding: "8px 16px",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => { handleConnect(); setMenuOpen(false); }}
                style={{
                  width: "100%",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#3b82f6",
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.2)",
                  borderRadius: 8,
                  padding: "10px 16px",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
