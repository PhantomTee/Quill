export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-border)",
        padding: "28px 24px",
        marginTop: "auto",
        backgroundColor: "var(--color-bg)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Quill — AI Agent Marketplace on Arc</span>
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--color-text-muted)" }}>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>
            Arc Explorer
          </a>
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>
            Faucet
          </a>
          <a href="/docs" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Docs</a>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Built on Arc Testnet · Chain ID 5042002 · USDC powered by Circle
        </div>
      </div>
    </footer>
  );
}
