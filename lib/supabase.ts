import { createClient } from "@supabase/supabase-js";

// Server-side client (service role — bypasses RLS)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Client-side client (anon key — respects RLS)
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

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
