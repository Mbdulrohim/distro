# Features — DISTRO

## Campaign creation (dashboard)

- Connect wallet (creator).
- Choose campaign type: Airdrop / Vesting / Batch Payout.
- Upload recipient list via CSV (address + amount, and for vesting: cliff/duration per recipient or campaign-wide defaults).
- Client-side validation: duplicate addresses, invalid addresses, amount totals vs. available token balance.
- Merkle tree generation (airdrop) with a downloadable proof set and on-dashboard verification (spot-check a few addresses against the generated root before deploying).
- Deploy campaign contract via factory; show deployment tx status.
- Fund campaign (transfer/approve tokens to the campaign contract).
- Campaign dashboard: recipient table with claim/release status, total distributed vs. remaining, export CSV.

## Airdrop (Merkle claim)

- Recipients claim via the claim portal; contract verifies Merkle proof, marks claimed, transfers tokens.
- One claim per address; no partial claims.
- Optional claim deadline, after which unclaimed funds can be recovered by the creator.

## Vesting

- Per-recipient schedule: cliff period, vesting duration, release curve (linear for v1).
- Recipients (or anyone on their behalf) can trigger a "release" call that sends the currently-vested, unreleased amount.
- Dashboard shows vested vs. released vs. remaining-locked per recipient.
- Creator cannot revoke or claw back by default; revocable vesting is a v2 consideration (see [ROADMAP.md](ROADMAP.md)).

## Batch payout

- Direct push to a list of recipients in one or more batched transactions (chunked to stay under gas/block limits).
- No claim step — funds arrive immediately on execution.
- Execution status per recipient (sent / failed / retried) surfaced in the dashboard.

## Claim portal (recipient-facing)

- Connect wallet, auto-detect eligibility across all campaigns tied to that address.
- Show claimable amount, campaign type, and any relevant schedule (vesting timeline).
- One-click claim/release with clear gas cost preview.

## Cross-cutting

- Campaign and recipient data indexed off-chain (Postgres) for fast dashboard queries, always reconciled against on-chain state — the chain is the source of truth.
- Notifications (email/webhook) on claim, planned post-v1 — see [ROADMAP.md](ROADMAP.md).
