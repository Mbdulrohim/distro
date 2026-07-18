-- Templates — a saved distribution shape (token + recipient list), reusable
-- as a starting point for a new distribution. See supabase/migrations/0001
-- for the conventions this follows (citext addresses, base-unit amounts).

create table templates (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references users(id) on delete cascade,
  name              text not null,
  token_address     citext not null,
  token_symbol      text not null,
  token_decimals    smallint not null check (token_decimals between 0 and 36),
  -- One row per recipient: {"address": "0x...", "amount": "1200000000"}.
  -- Kept as jsonb rather than a child table — a template is read/written as a
  -- single unit (no per-recipient status to track, unlike `recipients`), so a
  -- normalised table would only add join cost with no query it enables.
  recipients        jsonb not null default '[]'::jsonb,
  recipient_count   integer not null default 0 check (recipient_count >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create index templates_user_created_idx
  on templates (user_id, created_at desc);

alter table templates enable row level security;

-- Same ownership model as distributions: owner-scoped read for the anon
-- role; every mutation goes through the server with the service-role key.
create policy templates_owner_select on templates
  for select using (
    user_id in (select id from users where wallet_address = auth_wallet())
  );
