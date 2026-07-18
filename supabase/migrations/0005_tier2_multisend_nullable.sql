-- Follow-up to 0004: a `scheduled` (Tier-2, escrow) distribution never talks
-- to Multisend at all, so `multisend_address` can't stay NOT NULL now that
-- `kind` exists. A separate migration rather than editing 0004 in place —
-- once a migration has shipped, it's history, not a draft.

alter table distributions
  alter column multisend_address drop not null;

alter table distributions
  add constraint distributions_multisend_address_matches_kind check (
    (kind = 'immediate' and multisend_address is not null)
    or (kind = 'scheduled' and multisend_address is null)
  );
