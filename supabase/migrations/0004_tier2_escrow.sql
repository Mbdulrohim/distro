-- Tier 2 — scheduled, escrowed distributions (Distribution/DistributionFactory).
-- See contracts/src/Distribution.sol and docs/CONTRACT_SPEC.md.
--
-- A Tier-1 row (Multisend, immediate, ERC-20 only) and a Tier-2 row (escrow,
-- schedulable, MON or ERC-20) share the same `distributions`/`recipients`
-- tables rather than living in a parallel schema — a distribution's identity,
-- recipients, and history should not fork depending on which contract moved
-- the money. `kind` is the only thing that tells them apart, and every
-- Tier-2-only column is nullable so a Tier-1 row is unaffected.
--
-- NOTE: written to spec, not yet applied against a live Supabase project —
-- same status as every migration before it until `supabase db push` runs.

alter type distribution_status add value if not exists 'ready';
alter type distribution_status add value if not exists 'funded';
alter type distribution_status add value if not exists 'executing';
alter type distribution_status add value if not exists 'cancelled';

alter table distributions
  add column kind text not null default 'immediate'
    check (kind in ('immediate', 'scheduled')),
  -- The deployed `Distribution` clone's address once `createDistribution` on
  -- the factory confirms. Null until then, and always null for `immediate`.
  add column escrow_address citext,
  -- Null = no restriction (executable as soon as funded). Set by the
  -- creator's `schedule()` call — see Distribution.sol's decoupled schedule.
  add column execute_after timestamptz,
  -- The bytes32 salt passed to `createDistribution`, so the escrow address
  -- can be reproduced/verified via `predictAddress` without re-deriving it.
  add column salt citext;

-- An immediate row must never grow an escrow address (that would mean two
-- contracts think they own the same distribution). A scheduled row may be
-- briefly `escrow_address is null` while still `draft` — the on-chain
-- `createDistribution` call hasn't confirmed yet — but must have one by the
-- time it's past draft (ready/funded/executing/completed/failed/cancelled).
alter table distributions
  add constraint distributions_escrow_address_matches_kind check (
    (kind = 'immediate' and escrow_address is null)
    or (kind = 'scheduled' and (status = 'draft' or escrow_address is not null))
  );

create index distributions_escrow_address_idx
  on distributions (escrow_address)
  where escrow_address is not null;
