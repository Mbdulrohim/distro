# Roadmap — Distro

> Reflects the real product ([PRD.md](PRD.md)) — push-based distribution engine. Supersedes the pre-definition draft's airdrop/vesting phasing.

## Phase 0 — Foundation ✅

- Monorepo scaffold: Foundry (`contracts/`), Next.js 15 + Tailwind + shadcn/ui (`web/`), Supabase.
- `monskills` (Monad patterns) + `impeccable` (design review) wired in.
- CI: Foundry fmt/build/test + web lint/typecheck/build.

## Phase 1 — Wallet authentication ✅

- SIWE sign-in, Monad Mainnet only, stateless JWT session, protected dashboard.

## Phase 2 — Core distribution (v1 core)

**Blocked on the pre-implementation sequence** in [CONTRACT_SPEC.md](CONTRACT_SPEC.md) — decisions O1 (irrevocable mode) and O2 (execution incentive) change the contract's shape, and `MIN_GAS_PER_TRANSFER` / chunk size must come from measured Monad gas rather than a guess.

- `DistributionFactory` + `Distribution` escrow contracts (payload commitment + onchain DA, permissionless execution) per [CONTRACT_SPEC.md](CONTRACT_SPEC.md).
- Full Foundry coverage: unit + fuzz + the spec's invariants — starting with *"a chunk execution either records true outcomes or reverts entirely"*, the gas-griefing invariant.
- Dashboard: create → import CSV → validate → review → commit → fund → execute now.
- Per-recipient tracking from onchain events.
- **Rebuild-from-chain path** for the indexer. Not a disaster-recovery nicety: it is the same code path a third-party executor uses, so building it early keeps the permissionless claim honest and exercised rather than theoretical.

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

## Blocking decisions

**Before Phase 2 can start** (these change the contract's shape — see [CONTRACT_SPEC.md](CONTRACT_SPEC.md)):

1. **O1 — irrevocable mode?** Cancel-any-time makes "scheduled" a promise, not a guarantee. Fine for payroll, wrong for bounties/grants. Impossible to retrofit into an immutable clone.
2. **O2 — execution incentive?** Permissionless execution is only real if a non-Distro party is motivated to execute. Either add a gas tip from escrow, or drop the claim and say "the creator self-serves".
3. **O3 — recurring shape.** Deferring the *feature* is right; deferring this *decision* risks a v2 that cannot reuse v1's audited contract.

**Before the Phase 5 audit** — adding a fee mechanism post-audit means re-auditing, which is why the contracts ship with a 0-value fee hook:

4. **Monetization** — rate and *basis*. Not just a number: a per-recipient fee interacts with chunking and gas in ways a flat per-distribution fee doesn't, and it moves where the hook lives.
5. Team/org accounts — v1 single-wallet, or multi-user? Retrofitting an `organizations` layer under `distributions` later is a migration, not a feature.
6. Compliance posture — any address screening before payout?
