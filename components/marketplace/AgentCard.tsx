import Link from "next/link";
import { CategoryBadge, PriceBadge, TagBadge } from "@/components/ui/Badge";
import { truncateAddress } from "@/lib/utils";

interface AgentCardProps {
  agent: {
    agent_id: number;
    name: string;
    description: string | null;
    tags: string[];
    price_per_call: number;
    total_calls: number;
    total_revenue: number;
    wallet_address: string;
    is_active: boolean;
  };
}

export function AgentCard({ agent }: AgentCardProps) {
  const category = agent.tags[0]?.toUpperCase() ?? "CUSTOM";
  const revenue = parseFloat(String(agent.total_revenue)).toFixed(4);

  return (
    <Link href={`/agent/${agent.agent_id}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <CategoryBadge category={category} />
          </div>
          <PriceBadge pricePerCall={agent.price_per_call} />
        </div>

        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)", marginBottom: 5 }}>{agent.name}</h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              lineHeight: 1.55,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {agent.description ?? "No description provided."}
          </p>
        </div>

        {agent.tags.slice(1, 4).length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {agent.tags.slice(1, 4).map((tag) => <TagBadge key={tag} tag={tag} />)}
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-muted)" }}>
          <span>{agent.total_calls.toLocaleString()} calls</span>
          <span className="mono">${revenue} earned</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "monospace" }}>
            {truncateAddress(agent.wallet_address)}
          </span>
          <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 500 }}>View →</span>
        </div>
      </div>
    </Link>
  );
}
