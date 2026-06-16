-- Quill Supabase Schema
-- Run this in the Supabase SQL editor (or via supabase db push)

-- ── agents ────────────────────────────────────────────────────────────────────
create table public.agents (
  id               bigserial primary key,
  agent_id         bigint not null unique,
  name             text not null,
  description      text,
  service_url      text not null,
  price_per_call   bigint not null,
  wallet_address   text not null,
  owner_address    text not null,
  tags             text[] not null default '{}',
  category         text,
  is_active        boolean not null default true,
  registered_at    timestamptz not null,
  updated_at       timestamptz not null default now(),
  tx_hash          text,
  total_calls      bigint not null default 0,
  total_revenue    numeric(20,6) not null default 0,
  readme           text,
  logo_url         text,
  example_request  jsonb,
  example_response jsonb
);

create index idx_agents_agent_id on public.agents(agent_id);
create index idx_agents_owner_address on public.agents(owner_address);
create index idx_agents_is_active on public.agents(is_active) where is_active = true;
create index idx_agents_price on public.agents(price_per_call);
create index idx_agents_tags on public.agents using gin(tags);
create index idx_agents_fts on public.agents
  using gin(to_tsvector('english', name || ' ' || coalesce(description, '')));

alter table public.agents enable row level security;

create policy "Anyone can read active agents"
  on public.agents for select
  using (is_active = true);

create policy "Service role can write"
  on public.agents for all
  to service_role
  using (true);

-- ── payment_events ────────────────────────────────────────────────────────────
create table public.payment_events (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  agent_id         bigint references public.agents(agent_id),
  endpoint         text not null,
  payer            text not null,
  amount_usdc      numeric(20,6) not null,
  amount_raw       text not null,
  network          text not null default 'eip155:5042002',
  gateway_tx       text,
  batch_tx         text,
  status           text not null default 'settled'
                   check (status in ('settled', 'batched', 'confirmed', 'failed')),
  raw              jsonb
);

create index idx_payment_events_agent_id on public.payment_events(agent_id);
create index idx_payment_events_payer on public.payment_events(payer);
create index idx_payment_events_created_at on public.payment_events(created_at desc);
create index idx_payment_events_gateway_tx on public.payment_events(gateway_tx);

alter table public.payment_events enable row level security;

create policy "Public can read payment events"
  on public.payment_events for select
  using (true);

create policy "Service role can insert"
  on public.payment_events for insert
  to service_role
  with check (true);

create policy "Service role can update"
  on public.payment_events for update
  to service_role
  using (true);

-- ── withdrawals ───────────────────────────────────────────────────────────────
create table public.withdrawals (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  seller_address       text not null,
  agent_id             bigint references public.agents(agent_id),
  amount_usdc          numeric(20,6) not null,
  destination_chain    text not null,
  destination_address  text not null,
  status               text not null default 'submitted'
                       check (status in ('submitted', 'confirmed', 'failed')),
  tx_hash              text
);

create index idx_withdrawals_seller on public.withdrawals(seller_address);
create index idx_withdrawals_agent on public.withdrawals(agent_id);

alter table public.withdrawals enable row level security;

create policy "Sellers see own withdrawals"
  on public.withdrawals for select
  using (true);

create policy "Service role manages withdrawals"
  on public.withdrawals for all
  to service_role
  using (true);

-- ── sync_state ────────────────────────────────────────────────────────────────
-- Tracks the last block synced from Arc for the cron job
create table public.sync_state (
  id           text primary key,
  last_block   bigint not null default 0,
  updated_at   timestamptz not null default now()
);

insert into public.sync_state (id, last_block) values ('agent_registry', 0);

alter table public.sync_state enable row level security;

create policy "Service role manages sync_state"
  on public.sync_state for all
  to service_role
  using (true);

-- ── Realtime ──────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.payment_events;
alter publication supabase_realtime add table public.withdrawals;
