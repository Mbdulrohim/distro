# Roadmap — Distro

> Reflects the real product ([PRD.md](PRD.md)) — push-based distribution engine. Supersedes the pre-definition draft's airdrop/vesting phasing.

## Phase 0 — Foundation ✅

- Monorepo scaffold: Foundry (`contracts/`), Next.js 15 + Tailwind + shadcn/ui (`web/`), Supabase.
- `monskills` (Monad patterns) + `impeccable` (design review) wired in.
- CI: Foundry fmt/build/test + web lint/typecheck/build.

## Phase 1 — Wallet authentication ✅

- SIWE sign-in, Monad Mainnet only, stateless JWT session, protected dashboard.

## Phase 2 — Core distribution (v1 core)

- `DistributionFactory` + `Distribution` escrow contracts (chunk-commitment, permissionless execution) per [CONTRACT_SPEC.md](CONTRACT_SPEC.md).
- Full Foundry coverage: unit + fuzz + the invariants listed in the spec.
- Dashboard: create → import CSV → validate → review → approve + fund → execute now.
- Per-recipient tracking from onchain events.

## Phase 3 — Scheduling

- `executeAfter` enforcement, cancel + refund before execution.
- Keeper service triggering scheduled runs — plus the always-available manual path (keeper must never be a dependency).
- Timezone-safe scheduling UI (local + UTC).

## Phase 4 — Tracking & reliability

- Indexer (long-running service, reorg-safe, idempotent) + reconciliation job.
- Retry-failed-payments flow; reclaim undeliverable funds.
- CSV export, per-distribution audit timeline, explorer links.
- Realtime dashboard updates (Supabase Realtime) + explicit indexer-lag "syncing" state.

## Phase 5 — Hardening for mainnet

- External contract audit (blocking for mainnet).
- Slither/static analysis in CI.
- Public testnet period + bug bounty window before mainnet default.
- Load-test indexer against large distributions; RPC failover.
- Monad gas measurement → real chunk-size defaults (`monskills` `gas`).
- Observability: Sentry (web + indexer), onchain anomaly alerting.
- Safe multisig ownership verified on all privileged roles.

## v2

- **Recurring / repeating schedules** — the "Automation" pillar's full form (monthly payroll). Deferred from v1 to keep the first audit surface small.
- Team / organization accounts with roles (known gap — [CTO_REVIEW.md](CTO_REVIEW.md)).
- Notifications (email/webhook) on completion/failure.
- Native MON distribution (needs its own reentrancy/gas design pass).

## Unscoped / later

- NFT (ERC-721/1155) distribution.
- Multi-chain beyond Monad.
- Allowance-based execution mode (capital efficiency) as an opt-in alternative to escrow.
- EIP-7702 session-key execution.
- Public distribution pages / recipient-facing receipts.

## Blocking product decisions

Still unanswered, from [CTO_REVIEW.md](CTO_REVIEW.md) — **monetization must be settled before the Phase 5 audit**, since adding a fee mechanism post-audit means re-auditing (the contracts ship with a 0-value fee hook for exactly this reason):

1. Monetization model — fee rate and basis?
2. Team/org accounts — v1 single-wallet, or multi-user?
3. Compliance posture — any address screening before payout?
