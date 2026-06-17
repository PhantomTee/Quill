"use client";
import { useState, useEffect } from "react";
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

function HealthDot({ agentId }: { agentId: number }) {
  const [status, setStatus] = useState<"unknown" | "healthy" | "down">("unknown");

  useEffect(() => {
    fetch(`/api/agents/${agentId}/ping`)
      .then((r) => r.json())
      .then((d) => setStatus(d.healthy ? "healthy" : "down"))
      .catch(() => setStatus("down"));
  }, [agentId]);

  const color = status === "healthy" ? "#10b981" : status === "down" ? "#ef4444" : "#6b7280";
  const label = status === "healthy" ? "Live" : status === "down" ? "Down" : "Checking";

  return (
    <span
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        color,
        letterSpacing: "0.04em",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          boxShadow: status === "healthy" ? `0 0 0 2px ${color}30` : "none",
        }}
      />
      {label}
    </span>
  );
}

function StarDisplay({ avgRating, count }: { avgRating: number | null; count: number }) {
  if (!avgRating || count === 0) return null;
  const full = Math.floor(avgRating);
  const half = avgRating - full >= 0.5;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "#f59e0b" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ opacity: i <= full ? 1 : (i === full + 1 && half ? 0.55 : 0.2) }}>★</span>
      ))}
      <span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}>{avgRating} ({count})</span>
    </span>
  );
}

export function AgentCard({ agent }: AgentCardProps) {
  const [rating, setRating] = useState<{ avgRating: number | null; count: number } | null>(null);
  const category = agent.tags[0]?.toUpperCase() ?? "CUSTOM";
  const revenue = parseFloat(String(agent.total_revenue)).toFixed(4);

  useEffect(() => {
    fetch(`/api/agents/${agent.agent_id}/rate`)
      .then((r) => r.json())
      .then(setRating)
      .catch(() => null);
  }, [agent.agent_id]);

  return (
    <Link href={`/agent/${agent.agent_id}`} style={{ textDecoration: "none" }}>
      <div className="card-hover" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <CategoryBadge category={category} />
            <HealthDot agentId={agent.agent_id} />
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

        {rating && <StarDisplay avgRating={rating.avgRating} count={rating.count} />}

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
