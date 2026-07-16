-- Tier 1 schema — the Multisend MVP. See docs/DATABASE.md.
--
-- Offchain data is a cache over onchain state; the chain is the source of
-- truth. Amounts are ALWAYS base units. Addresses are citext so casing can
-- never fork an identity or silently miss an RLS policy.
--
-- NOTE: written to spec, not yet applied against a live Supabase project.
-- Apply with `supabase db push` (or `supabase migration up`) once a project
-- exists, then run the RLS attack tests before trusting it.

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Enums (mirror the onchain/receipt state machines exactly — no product-only
-- states; "scheduled but unfunded" etc. are derived at read time in Tier 2).
-- ---------------------------------------------------------------------------
create type distribution_status as enum (
  'draft', 'submitted', 'partially_completed', 'completed', 'failed'
);
create type transaction_status as enum ('pending', 'mined', 'reverted');
create type recipient_status as enum ('pending', 'paid', 'failed');

-- ---------------------------------------------------------------------------
-- users — wallet identity (SIWE); no separate auth account.
-- ---------------------------------------------------------------------------
create table users (
  id             uuid primary key default gen_random_uuid(),
  wallet_address citext not null unique,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- distributions — one logical send. In the MVP a distribution is NOT its own
-- contract (all runs share the single deployed Multisend), so there is no
-- salt / contract_address / escrow state machine here (those are Tier 2).
-- ---------------------------------------------------------------------------
create table distributions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete restrict,
  chain_id          integer not null,
  multisend_address citext not null,
  name              text not null,
  token_address     citext not null,
  token_symbol      text not null,
  token_decimals    smallint not null check (token_decimals between 0 and 36),
  -- uint256-capable; always base units.
  total_amount      numeric(78, 0) not null check (total_amount >= 0),
  recipient_count   integer not null check (recipient_count > 0),
  status            distribution_status not null default 'draft',
  csv_storage_path  text,
  created_at        timestamptz not null default now(),
  submitted_at      timestamptz,
  completed_at      timestamptz,
  deleted_at        timestamptz
);

-- ---------------------------------------------------------------------------
-- distribution_transactions — one row per `distribute` call (a large list is
-- sent as several batched transactions).
-- ---------------------------------------------------------------------------
create table distribution_transactions (
  id              uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references distributions(id) on delete cascade,
  batch_index     integer not null,
  tx_hash         citext,
  status          transaction_status not null default 'pending',
  block_number    bigint,
  gas_used        bigint,
  submitted_at    timestamptz,
  mined_at        timestamptz,
  unique (distribution_id, batch_index)
);

-- ---------------------------------------------------------------------------
-- recipients — the payout ledger. `index_in_batch` maps a Paid/PaymentFailed
-- event (which carries only an index) back to its row, and is load-bearing:
-- never reorder it. Deliberately NOT unique on (distribution_id, address) —
-- paying the same address twice is legal by design. The uint128 check rejects
-- a value the contract cannot accept, at write time.
-- ---------------------------------------------------------------------------
create table recipients (
  id              uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references distributions(id) on delete cascade,
  transaction_id  uuid references distribution_transactions(id) on delete set null,
  batch_index     integer not null,
  index_in_batch  integer not null,
  address         citext not null,
  amount          numeric(78, 0) not null
                    check (amount >= 1 and amount <= 340282366920938463463374607431768211455),
  status          recipient_status not null default 'pending',
  failure_reason  text,
  paid_at         timestamptz,
  unique (distribution_id, batch_index, index_in_batch)
);

-- ---------------------------------------------------------------------------
-- Indexes for the dashboard's query patterns (docs/DATABASE.md).
-- ---------------------------------------------------------------------------
create index distributions_user_created_idx
  on distributions (user_id, created_at desc);
create index distributions_status_idx
  on distributions (status);
create index distribution_transactions_tx_hash_idx
  on distribution_transactions (tx_hash);
create index recipients_distribution_status_idx
  on recipients (distribution_id, status);
create index recipients_address_idx
  on recipients (address);
