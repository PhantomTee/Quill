export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`badge badge-${category.toLowerCase()}`}>
      {category}
    </span>
  );
}

export function PriceBadge({ pricePerCall }: { pricePerCall: number }) {
  const usdc = pricePerCall / 1_000_000;
  const display = usdc < 0.001 ? usdc.toFixed(6) : usdc < 0.01 ? usdc.toFixed(4) : usdc.toFixed(3);
  return (
    <span
      className="badge"
      style={{ background: "rgba(59,130,246,0.1)", color: "#2563eb", fontFamily: "monospace" }}
    >
      ${display} / call
    </span>
  );
}

export function TagBadge({ tag }: { tag: string }) {
  return (
    <span
      className="badge"
      style={{ background: "rgba(0,0,0,0.05)", color: "#6b7280", border: "1px solid rgba(0,0,0,0.06)" }}
    >
      {tag}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    settled: { bg: "rgba(16,185,129,0.1)", text: "#059669" },
    confirmed: { bg: "rgba(16,185,129,0.15)", text: "#047857" },
    failed: { bg: "rgba(239,68,68,0.1)", text: "#dc2626" },
    batched: { bg: "rgba(245,158,11,0.1)", text: "#d97706" },
  };
  const c = colors[status] ?? colors.settled;
  return (
    <span className="badge" style={{ background: c.bg, color: c.text }}>
      {status}
    </span>
  );
}
