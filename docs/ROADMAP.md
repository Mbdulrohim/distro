# Roadmap — Distro

> Reflects the real product ([PRD.md](PRD.md)) — push-based distribution engine. Supersedes the pre-definition draft's airdrop/vesting phasing.

## Phase 0 — Foundation ✅

- Monorepo scaffold: Foundry (`contracts/`), Next.js 15 + Tailwind + shadcn/ui (`web/`), Supabase.
- `monskills` (Monad patterns) + `impeccable` (design review) wired in.
- CI: Foundry fmt/build/test + web lint/typecheck/build.

## Phase 1 — Wallet authentication ✅

- SIWE sign-in, Monad Mainnet only, stateless JWT session, protected dashboard.

## Phase 2 — Multisend MVP (current)

Per [CTO_REVIEW.md](CTO_REVIEW.md) S1: escrow, keeper, indexer, and onchain DA all exist to serve *scheduling*, which the PRD's problem statement never asks for. This phase ships the validated pain — bulk, tracking, retry — with none of that machinery.

**Contract — done.** `contracts/src/Multisend.sol`:
- Stateless. Tokens move `msg.sender → recipient` directly, so the contract's balance is always zero — a failed payment simply doesn't happen and the tokens stay with the sender. No refund path, no state machine, no stranded funds.
- No owner, no pause, no fee: nothing to govern, and being stateless makes it trivially replaceable.
- Per-recipient failure isolation (one blocklisted address can't revert a payroll run); retry is just a second call with the failed subset.
- Handles non-standard ERC-20s: USDT-class (no return value), `false`-returning, and garbage-returning tokens.
- 31 tests: unit, fuzz, reentrancy, gas benchmarks.

**Remaining for MVP:**
- Dashboard: connect → import CSV → validate → review → approve → distribute.
- Parse results from the execution receipt client-side. **No indexer service** — the transaction's own receipt carries every `Paid`/`PaymentFailed` event.
- Supabase for history only.
- Testnet deploy + verification (monskills verification API).

**Blocking mainnet:**
- `MIN_GAS_PER_TRANSFER` must be measured on Monad. The current `100_000` is a conservative placeholder; local marginal cost is ~28.6k, and the naive "×4 for Monad cold access" extrapolation is invalid (that penalty doesn't apply to the ~20k SSTORE that dominates). See `test/Multisend.gas.t.sol`.
- External audit. Small surface (~100 lines), so this is cheap relative to the escrow.

## Phase 3 — Scheduling (escrow)

**Blocked on decisions O1 (irrevocable mode) and O2 (execution incentive)** in [CONTRACT_SPEC.md](CONTRACT_SPEC.md) — both change contract shape and cannot be retrofitted into an immutable clone.

Only start this once scheduling demand is validated. `Multisend` is untouched by this work; the escrow is a separate contract reusing the same payload encoding.

- `DistributionFactory` + `Distribution` escrow (payload commitment + onchain DA, permissionless execution).
- Fuzz the spec's invariants — starting with *"a chunk execution either records true outcomes or reverts entirely"*, the gas-griefing invariant. Note that griefing is a real threat **only here**, where execution is permissionless; in `Multisend` the caller can only ever move their own tokens.
- Keeper service + the always-available manual path.
- Timezone-safe scheduling UI (local + UTC).
- **Notifications ship with this phase, not later** ([CTO_REVIEW.md](CTO_REVIEW.md) UX1): a Ready-but-unfunded distribution silently no-ops at its scheduled time, the chain gives no signal, and the user is not looking at the dashboard at 9am on payday.
- **Rebuild-from-chain path** for the indexer — the same code path a third-party executor uses, so building it keeps the permissionless claim exercised rather than theoretical.

## Phase 3 — Scheduling

- `executeAfter` enforcement, cancel + refund before execution.
- Keeper service triggering scheduled runs — plus the always-available manual path (keeper must never be a dependency).
- Timezone-safe scheduling UI (local + UTC).

## Phase 4 — Tracking & reliability (with scheduling)

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
