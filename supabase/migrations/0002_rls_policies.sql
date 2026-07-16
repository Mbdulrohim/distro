-- Row-level security — the entire access-control story. See docs/DATABASE.md.
--
-- Identity is the wallet address from the SIWE JWT (`auth.jwt() ->> 'address'`),
-- compared as citext so casing can't silently miss. A user reaches child rows
-- only through their parent distribution's ownership.
--
-- State-transitioning writes belong to the server/indexer (service role, which
-- bypasses RLS), NOT the browser. The anon client gets read scoped to its own
-- rows and nothing else — no insert/update/delete grants here.
--
-- DEPENDENCY: this assumes the session JWT is presented to Supabase as its
-- access token with an `address` claim (ARCHITECTURE.md §6). Wiring the SIWE
-- JWT to be Supabase-consumable is the remaining half of that integration; the
-- policies are correct, but they only bite once that wiring lands.
--
-- NOTE: written to spec, not yet applied. Ship the cross-tenant attack tests
-- (supabase/tests/rls.test.sql) alongside applying this.

alter table users enable row level security;
alter table distributions enable row level security;
alter table distribution_transactions enable row level security;
alter table recipients enable row level security;

-- Helper: the caller's wallet address from the JWT, or null.
create or replace function auth_wallet() returns citext
  language sql stable
  as $$ select nullif(auth.jwt() ->> 'address', '')::citext $$;

-- users — a wallet sees only its own row.
create policy users_self_select on users
  for select using (wallet_address = auth_wallet());

-- distributions — creator-scoped read; no public read (no public pages in v1).
create policy distributions_owner_select on distributions
  for select using (
    user_id in (select id from users where wallet_address = auth_wallet())
  );

-- Child tables — reachable only via an owned distribution.
create policy transactions_owner_select on distribution_transactions
  for select using (
    distribution_id in (
      select d.id from distributions d
      join users u on u.id = d.user_id
      where u.wallet_address = auth_wallet()
    )
  );

create policy recipients_owner_select on recipients
  for select using (
    distribution_id in (
      select d.id from distributions d
      join users u on u.id = d.user_id
      where u.wallet_address = auth_wallet()
    )
  );

-- No insert/update/delete policies for the anon role on any table: every
-- mutation goes through the server with the service-role key, which is exempt
-- from RLS. This is deliberate, not an omission.
