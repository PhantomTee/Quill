import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: { label: string; href: string };
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ width: 40, height: 40, margin: "0 auto 16px", borderRadius: "50%", border: "2px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)", marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "var(--color-text-secondary)", fontSize: 14, maxWidth: 400, margin: "0 auto 24px" }}>{description}</p>
      {action && (
        <Link href={action.href} className="btn btn-primary" style={{ textDecoration: "none" }}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
