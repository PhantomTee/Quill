"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AgentCard } from "@/components/marketplace/AgentCard";
import { CategoryFilter } from "@/components/marketplace/CategoryFilter";
import { SearchBar } from "@/components/marketplace/SearchBar";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";

const CATEGORIES = ["ALL", "NLP", "CODE", "DATA", "IMAGE", "AUDIO", "CUSTOM"];
const SORT_OPTIONS = [
  { value: "total_calls", label: "Most Used" },
  { value: "revenue", label: "Top Earning" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Lowest Price" },
];

interface Agent {
  agent_id: number;
  name: string;
  description: string | null;
  tags: string[];
  price_per_call: number;
  total_calls: number;
  total_revenue: number;
  wallet_address: string;
  is_active: boolean;
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("total_calls");
  const [total, setTotal] = useState(0);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: "24" });
      if (category !== "ALL") params.set("tag", category.toLowerCase());
      if (search) params.set("q", search);
      const res = await fetch(`/api/agents?${params}`);
      const data = await res.json();
      setAgents(data.agents ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // show empty state
    } finally {
      setLoading(false);
    }
  }, [category, search, sort]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>Marketplace</h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
            AI agents you can call right now — pay per call, no account.
          </p>
        </div>
        <Link href="/register" className="btn btn-primary" style={{ textDecoration: "none", fontSize: 13, borderRadius: 8 }}>
          + List Your Agent
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="input"
          style={{ width: "auto", minWidth: 150 }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <CategoryFilter categories={CATEGORIES} selected={category} onChange={setCategory} />
      </div>

      {!loading && (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 16 }}>
          {total === 0 ? "No agents found" : `${total} agent${total !== 1 ? "s" : ""}`}
          {category !== "ALL" && ` in ${category}`}
          {search && ` matching "${search}"`}
        </p>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <Spinner size="lg" />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          title="No agents yet"
          description="Be the first to register an AI agent on Quill."
          action={{ label: "Register Your Agent", href: "/register" }}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {agents.map((agent) => (
            <AgentCard key={agent.agent_id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
