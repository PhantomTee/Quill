"use client";
import { useState, useEffect, useCallback, useRef } from "react";

export interface MarketplaceAgent {
  agent_id: number;
  name: string;
  description: string | null;
  service_url: string;
  price_per_call: number;
  wallet_address: string;
  tags: string[];
  category: string | null;
  total_calls: number;
  total_revenue: number;
  is_active: boolean;
  registered_at: string;
}

interface UseMarketplaceOptions {
  q?: string;
  tag?: string;
  category?: string;
  sort?: string;
  limit?: number;
}

export function useMarketplace(options: UseMarketplaceOptions = {}) {
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetch_ = useCallback(
    async (pageNum: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ page: String(pageNum), limit: String(options.limit ?? 12) });
      if (options.q) params.set("q", options.q);
      if (options.tag) params.set("tag", options.tag);
      if (options.category && options.category !== "ALL") params.set("category", options.category);
      if (options.sort) params.set("sort", options.sort);

      try {
        const res = await fetch(`/api/agents?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAgents(data.agents ?? []);
        setTotal(data.total ?? 0);
      } catch (e: unknown) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [options.q, options.tag, options.category, options.sort, options.limit]
  );

  useEffect(() => {
    setPage(1);
    fetch_(1);
  }, [options.q, options.tag, options.category, options.sort]);

  useEffect(() => {
    fetch_(page);
  }, [page]);

  return {
    agents,
    total,
    page,
    setPage,
    loading,
    error,
    hasMore: page * (options.limit ?? 12) < total,
    refresh: () => fetch_(page),
  };
}
