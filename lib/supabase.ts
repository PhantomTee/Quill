import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singletons — instantiated on first use so build-time module evaluation
// doesn't crash when env vars are injected only at runtime (Vercel).
let _supabase: SupabaseClient | null = null;
let _supabaseClient: SupabaseClient | null = null;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _supabase;
}

export function getSupabaseClient() {
  if (!_supabaseClient) {
    _supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
  }
  return _supabaseClient;
}

// Convenience shorthands used throughout the codebase
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const supabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Agent = {
  id: number;
  agent_id: number;
  name: string;
  description: string | null;
  service_url: string;
  price_per_call: number;
  wallet_address: string;
  owner_address: string;
  tags: string[];
  is_active: boolean;
  registered_at: string;
  updated_at: string;
  tx_hash: string | null;
  total_calls: number;
  total_revenue: number;
  readme: string | null;
  logo_url: string | null;
  example_request: Record<string, unknown> | null;
  example_response: Record<string, unknown> | null;
};

export type PaymentEvent = {
  id: string;
  created_at: string;
  agent_id: number;
  endpoint: string;
  payer: string;
  amount_usdc: number;
  amount_raw: string;
  network: string;
  gateway_tx: string | null;
  batch_tx: string | null;
  status: "settled" | "batched" | "confirmed" | "failed";
  raw: Record<string, unknown> | null;
};
