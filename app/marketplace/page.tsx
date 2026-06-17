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
  { value: "price_desc", label: "Highest Price" },
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

function PriceRangeSlider({
  min, max, onApply,
}: {
  min: string; max: string; onApply: (min: string, max: string) => void;
}) {
  const [localMin, setLocalMin] = useState(min);
  const [localMax, setLocalMax] = useState(max);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>Price (USDC):</span>
      <input
        type="number"
        min="0"
        step="0.001"
        placeholder="Min"
        value={localMin}
        onChange={(e) => setLocalMin(e.target.value)}
        style={{ width: 70, fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text)", outline: "none" }}
      />
      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>–</span>
      <input
        type="number"
        min="0"
        step="0.001"
        placeholder="Max"
        value={localMax}
        onChange={(e) => setLocalMax(e.target.value)}
        style={{ width: 70, fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface-alt)", color: "var(--color-text)", outline: "none" }}
      />
      <button
        onClick={() => onApply(localMin, localMax)}
        style={{ fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-secondary)", cursor: "pointer" }}
      >
        Apply
      </button>
      {(localMin || localMax) && (
        <button
          onClick={() => { setLocalMin(""); setLocalMax(""); onApply("", ""); }}
          style={{ fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer" }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("total_calls");
  const [total, setTotal] = useState(0);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: "24" });
      if (category !== "ALL") params.set("tag", category.toLowerCase());
      if (search) params.set("q", search);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);
      const res = await fetch(`/api/agents?${params}`);
      const data = await res.json();
      setAgents(data.agents ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // show empty state
    } finally {
      setLoading(false);
    }
  }, [category, search, sort, minPrice, maxPrice]);

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

      {/* Search + Sort */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
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

      {/* Price range filter */}
      <div style={{ marginBottom: 12 }}>
        <PriceRangeSlider
          min={minPrice}
          max={maxPrice}
          onApply={(mn, mx) => { setMinPrice(mn); setMaxPrice(mx); }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <CategoryFilter categories={CATEGORIES} selected={category} onChange={setCategory} />
      </div>

      {!loading && (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 16 }}>
          {total === 0 ? "No agents found" : `${total} agent${total !== 1 ? "s" : ""}`}
          {category !== "ALL" && ` in ${category}`}
          {search && ` matching "${search}"`}
          {(minPrice || maxPrice) && ` · price filter active`}
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
