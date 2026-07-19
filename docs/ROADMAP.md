# Roadmap — Distro

> Reflects the real product ([PRD.md](PRD.md)) — push-based distribution engine. Supersedes the pre-definition draft's airdrop/vesting phasing.

## Phase 0 — Foundation ✅

- Monorepo scaffold: Foundry (`contracts/`), Next.js 15 + Tailwind + shadcn/ui (`web/`), Neon Postgres.
- `monskills` (Monad patterns) + `impeccable` (design review) wired in.
- CI: Foundry fmt/build/test + web lint/typecheck/build.

## Phase 1 — Wallet authentication ✅

- SIWE sign-in, Monad Mainnet only, stateless JWT session, protected dashboard.

## Phase 2 — Multisend MVP (current)

Per [CTO_REVIEW.md](CTO_REVIEW.md) S1: escrow, keeper, indexer, and onchain DA all exist to serve _scheduling_, which the PRD's problem statement never asks for. This phase ships the validated pain — bulk, tracking, retry — with none of that machinery.

**Contract — done.** `contracts/src/Multisend.sol`:

- Stateless. Tokens move `msg.sender → recipient` directly, so the contract's balance is always zero — a failed payment simply doesn't happen and the tokens stay with the sender. No refund path, no state machine, no stranded funds.
- No owner, no pause, no fee: nothing to govern, and being stateless makes it trivially replaceable.
- Per-recipient failure isolation (one blocklisted address can't revert a payroll run); retry is just a second call with the failed subset.
- Handles non-standard ERC-20s: USDT-class (no return value), `false`-returning, and garbage-returning tokens.
- 31 tests: unit, fuzz, reentrancy, gas benchmarks.

**Remaining for MVP:**

- Dashboard: connect → import CSV → validate → review → approve → distribute.
- Parse results from the execution receipt client-side. **No indexer service** — the transaction's own receipt carries every `Paid`/`PaymentFailed` event.
- Neon Postgres for history only.
- Testnet deploy + verification (monskills verification API).

**Blocking mainnet:**

- `MIN_GAS_PER_TRANSFER` must be measured on Monad. The current `100_000` is a conservative placeholder; local marginal cost is ~28.6k, and the naive "×4 for Monad cold access" extrapolation is invalid (that penalty doesn't apply to the ~20k SSTORE that dominates). See `test/Multisend.gas.t.sol`.
- External audit. Small surface (~100 lines), so this is cheap relative to the escrow.

## Phase 3 — Scheduling (escrow)

**Blocked on decisions O1 (irrevocable mode) and O2 (execution incentive)** in [CONTRACT_SPEC.md](CONTRACT_SPEC.md) — both change contract shape and cannot be retrofitted into an immutable clone.

Only start this once scheduling demand is validated. `Multisend` is untouched by this work; the escrow is a separate contract reusing the same payload encoding.

- `DistributionFactory` + `Distribution` escrow (payload commitment + onchain DA, permissionless execution).
- Fuzz the spec's invariants — starting with _"a chunk execution either records true outcomes or reverts entirely"_, the gas-griefing invariant. Note that griefing is a real threat **only here**, where execution is permissionless; in `Multisend` the caller can only ever move their own tokens.
- Keeper service + the always-available manual path.
- Timezone-safe scheduling UI (local + UTC).
- **Notifications ship with this phase, not later** ([CTO_REVIEW.md](CTO_REVIEW.md) UX1): a Ready-but-unfunded distribution silently no-ops at its scheduled time, the chain gives no signal, and the user is not looking at the dashboard at 9am on payday.
- **Rebuild-from-chain path** for the indexer — the same code path a third-party executor uses, so building it keeps the permissionless claim exercised rather than theoretical.

## Phase 4 — Tracking & reliability

Ships alongside Phase 3 — these are what make an escrow-based scheduled run observable. The MVP needs none of it, because the creator is present and the receipt tells the whole story.

- Indexer (long-running service, reorg-safe, idempotent) + reconciliation job.
- `cancel` / `reclaim` flows for the escrow.
- CSV export, per-distribution audit timeline, explorer links.
- Indexer-driven dashboard updates + explicit indexer-lag "syncing" state.

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

**Before the MVP's mainnet launch:**

1. **Measure `MIN_GAS_PER_TRANSFER` on Monad.** A guessed value makes the floor either decorative or actively harmful. See `contracts/test/Multisend.gas.t.sol`.
2. **Audit `Multisend`.** Small surface, so this is the cheap one — but it's still 4-8 weeks of lead time and the only unparallelizable item. Plan the calendar backwards from it.
3. **Per-distribution size cap for the first mainnet weeks?** ([CTO_REVIEW.md](CTO_REVIEW.md) S3.) Note `Multisend` is stateless and has no owner, so a cap can't be a contract parameter here — it would be a frontend/product limit, or a reason to reconsider.

**Before Phase 3 (escrow) starts** — these change contract shape and cannot be retrofitted into an immutable clone:

4. ~~**O1 — irrevocable mode?**~~ **DECIDED 2026-07-16 — always cancellable, no irrevocable flag.** Consequence to carry into product copy: a scheduled distribution is a _promise, not a guarantee_, so Distro is not yet suited to bounties/grants where credible commitment is the point. Adding it later = new implementation + new audit.
5. ~~**O2 — execution incentive?**~~ **DECIDED 2026-07-16 — Distro keeper + creator/anyone fallback, no gas tip.** Execution stays permissionless, but nobody is _paid_ to execute, so absent Distro the realistic executor is the creator. State it that way: permissionlessness is a safety net, not a keeper ecosystem. A gas tip is an additive upgrade path, not a v1 requirement.
6. **O3 — recurring shape.** Still open. Deferring the _feature_ is right; deferring this _decision_ risks a v2 that cannot reuse v1's audited contract.

**Product decisions with no deadline yet, but real consequences:**

7. **Monetization** — rate and _basis_. `Multisend` deliberately ships with no fee hook (it's stateless, so a fee version is a redeploy plus a config change, not a migration). But the _basis_ — per recipient, per distribution, or volume — changes the escrow's design, so decide before Phase 3.
8. **Airdrop scope** ([CTO_REVIEW.md](CTO_REVIEW.md) P2). Push is the wrong economics above ~1,000 recipients. Either qualify the claim to community-scale, or plan a claim mode as a distinct product.
9. Team/org accounts — v1 single-wallet, or multi-user? Retrofitting an `organizations` layer under `distributions` later is a migration, not a feature.
10. Compliance posture — any address screening before payout?
