# CTO Review — Distro, before engineering begins

Reviewed: [PRD](PRD.md) · [FEATURES](FEATURES.md) · [USER_FLOW](USER_FLOW.md) · [CONTRACT_SPEC](CONTRACT_SPEC.md) v2 · [DATABASE](DATABASE.md) · [API](API.md) · [ROADMAP](ROADMAP.md) · [BRAND](BRAND.md) · [PRODUCT](../PRODUCT.md)

Stack: Next.js 15, React, TS, Tailwind, shadcn/ui, wagmi, viem, Foundry, Solidity, Supabase. Monad Mainnet.

> **Supersedes the v1 review** (written before the product definition existed, against a claim-based model that was never Distro). Contract-level findings live in [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) and are not repeated here; this document reviews the **product, scope, and engineering plan**.

The architecture is now sound. My concern is no longer _"is this correct?"_ — it's **"is this the right thing to build, and is it the right size?"** Two of the findings below argue we are building substantially more than the stated problem requires.

---

## 🔴 P1 — The stated problem never mentions scheduling, but half the architecture exists to serve it

The PRD's Problem section, in full, is: teams _copy addresses, verify them, enter amounts, repeat transactions, track status, retry failures, and keep records by hand._

Every one of those is about **bulk, tracking, and retry**. Not one is about **timing**. Nobody in that paragraph is complaining that they can't pay people next Friday.

Yet Scheduling is a pillar, and it is the _sole reason_ for almost all of the system's complexity:

| Component                                            | Exists because of                                               |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| Escrow contract                                      | scheduling (funds must be present while the creator is offline) |
| Chunk commitment + onchain DA                        | escrow (a third party must reconstruct the list)                |
| `cancel` / `reclaim` / grace period                  | escrow (funds can get stuck)                                    |
| Keeper service + hot wallet + MON reserve monitoring | scheduling                                                      |
| Indexer service                                      | keeper (the creator wasn't present to watch the tx)             |
| The gas-griefing attack surface                      | permissionless execution, which exists for scheduling           |

**Delete scheduling and nearly all of it evaporates.** A distribution that executes _now_, while the creator is present and signing, needs no escrow at all — just `approve` + a stateless multisend that pulls via `transferFrom` and pushes. No custody, no state machine, no data-availability problem, no keeper, no reclaim path, no stranded funds.

This is not an argument that scheduling is worthless — payroll genuinely wants it. It's an argument that **scheduling is an unvalidated hypothesis carrying the entire cost of the system**, while the validated pain (bulk + tracking + retry) needs almost none of it.

**Recommendation:** ship the validated thing first. See S1.

---

## 🔴 P2 — Push is economically wrong for the airdrop use case, which is listed as a headline use case

Airdrops appear in the PRD's opening line, its use-case list, and its vision. But push and airdrops are a bad match at real airdrop scale, for two independent reasons.

**Gas.** In a push model the sender pays for every recipient. At ~50k gas per ERC-20 transfer to a cold address (higher on Monad, where cold state access runs 3–4× Ethereum — must be measured, not assumed):

| Recipients                | Sender's execution gas | Commit/DA gas |
| ------------------------- | ---------------------- | ------------- |
| 200 (payroll)             | ~10M                   | ~58k          |
| 5,000 (community rewards) | ~250M                  | ~1.4M         |
| 100,000 (real airdrop)    | **~5B**                | ~29M          |

A claim-based airdrop costs the sender ~100k gas total, because each claimant pays their own.

**Claim rates.** Most airdrop allocations are never claimed — commonly only 10–30% are. A claim model means you only spend tokens on people who wanted them. **Push means you pay 100% of the gas and distribute 100% of the tokens, including to the ~75% of wallets that would never have bothered.** You're not just spending more gas; you're spending tokens you'd have kept.

So for a 100k airdrop, push costs the sender orders of magnitude more gas _and_ ~4–5× the tokens. This isn't a tuning problem — it's the wrong tool. It is precisely why virtually every large airdrop in the industry is claim-based.

Push is genuinely better where recipients are **known, few, and must actually receive the funds without opting in**: payroll, grants, bounties, contributor comp, hackathon prizes, revenue share. That's most of the use-case list — and it's a strong product.

**Recommendation:** qualify the claim. "Airdrops" in Distro means community distributions in the hundreds-to-low-thousands, where push's zero-friction delivery is an advantage. Mass speculative airdrops are **out of scope**, and should be stated as such rather than implied by the marketing. If they later become a target, that's a _claim mode_ — a second contract alongside the push engine, not a replacement.

> The irony is noted: the pre-definition draft was Merkle-claim-based. Deleting it was still correct — it was specced as _the_ model rather than as one mode for one use case.

---

## 🟠 S1 — MVP is over-scoped; a multisend-first MVP tests the hypothesis in a fraction of the surface

Current v1 requires, before a single user is served: escrow contracts + external audit + dashboard + indexer service + keeper service + Supabase/RLS. For a pre-revenue startup that is months of work and a $30–100k audit before you learn whether anyone wants this.

**Proposed MVP — "bulk send, now":**

- One stateless `Multisend` contract: `distribute(token, payload)` → `transferFrom` the creator, push to all recipients, try/catch per transfer, emit `Paid` / `PaymentFailed`. On the order of 100 lines.
- Creator signs `approve` then `distribute` **in the same session** — a short-lived allowance consumed immediately, the same pattern every DEX uses. Distro never holds funds or standing power, so "not a custodian" holds trivially.
- **No indexer service.** The execution transaction's own receipt contains every `Paid`/`PaymentFailed` event — parse it client-side. Supabase stores history only.
- **No keeper.** The creator is present.
- **No escrow, no commit phase, no DA problem, no state machine, no cancel/reclaim, no stranded funds, no grace period.**
- Retry = a second `distribute` with the failed subset.

This delivers the entire stated problem — bulk, tracking, retry, records — and it is _dramatically_ cheaper to audit, because the attack surface is roughly "does the loop pay the right people."

**Then v1.1 adds scheduling** as a _separate_ escrow contract reusing the same payload encoding and execution logic. The multisend contract stays untouched and already-audited. Nothing is thrown away; the escrow's complexity is paid for only once scheduling is validated.

The current spec is the right _destination_. It is the wrong _first step_.

---

## 🟠 S2 — The v1 surface requires ops a small team may not have

Even at full scope, be honest about what "production-ready" implies operationally:

- **Keeper**: a hot wallet holding MON, which must stay above Monad's 10 MON reserve floor or it silently stops sending. Needs funding automation, balance alerting, failure alerting, and someone on call — because its failure mode is _missed payroll_, the one thing the product promises never happens.
- **Indexer**: a long-running service (not serverless), reorg-safe, idempotent, with a reconciliation job. Its own deploy target, monitoring, and restart semantics.
- **Audit**: 4–8 weeks lead time and $30–100k, and it must happen _after_ the contracts stabilize. This is the long pole — plan the calendar backwards from it.

The MVP in S1 eliminates the first two entirely and shrinks the third.

---

## 🟠 S3 — Consider a TVL/size cap for the first mainnet weeks

The PRD's bar is "zero funds lost." An audit reduces risk; it doesn't eliminate it. For the first mainnet period, a per-distribution cap (and/or an allowlist of early users) bounds the blast radius of an unknown bug to something survivable.

This is cheap to add as a factory parameter now and removable later. Retrofitting it after an incident is not an option, and "we capped exposure during the bake-in period" is a _sellable_ trust signal, not an admission of weakness.

---

## 🟡 UX1 — The unfunded no-op is the product's sharpest edge

Decoupling funding from creation (correct — it removes the capital lock-up) creates a state the chain cannot help with: **Ready but unfunded, scheduled time arrives, nothing happens.** No revert, no event, no signal. Payroll silently doesn't run.

The contract cannot fix this. It is entirely the dashboard's burden, and a dashboard is not where the user is at 9am on payday — their email is.

**This single failure mode is a stronger argument for shipping notifications than everything on the v2 list.** If scheduling ships without a "your distribution is unfunded and runs in 12 hours" notification, the first real payroll miss will be Distro's fault in every way that matters to the customer, regardless of what the contract did.

## 🟡 UX2 — Chunk mechanics must not leak into the product

Chunking is a gas artifact. Users think in _"pay these 400 people."_ Commit-across-N-transactions, chunk indices, per-chunk execution, and partial chunk state are all implementation detail. If the UI ever says "chunk 3 of 7 failed," the abstraction has failed.

The creator should see: recipients, a total, a status, and failures. One review step, one funding step, one progress bar — even when that's 9 transactions underneath.

## 🟡 UX3 — Test payment is under-specified for how important it is

[FEATURES.md](FEATURES.md) now lists it, but it needs a real design. The instinct to send $1 before $200k is universal and correct, and it is the _only_ non-destructive rehearsal available for an irreversible action. Decide whether it's a separate one-recipient distribution (simple, real, costs a second flow) or a first-chunk-only execution (elegant, but couples to chunk mechanics UX2 says to hide).

## 🟡 UX4 — Decimals remain the highest-probability money bug

Human units in the CSV, base units onchain, `uint128` cap in the payload, `numeric(78,0)` in Postgres, and a token-supplied `decimals` that the UI must round-trip correctly. This is where a real distribution goes wrong by 10^18.

The review step must show **both** representations and the token symbol, and the validator must reject a value exceeding `uint128` at import — Postgres will happily store a number the contract cannot accept, and that mismatch surfaces at execution, after funding.

## 🟡 UX5 — Wrong-network and wallet-mismatch states

Mainnet-only is enforced at sign-in, but a user can switch networks mid-session, or connect wallet B to a distribution created by wallet A. Both need designed states, not a silent empty dashboard.

---

## Missing edge cases

- **Token pauses between funding and execution** (USDC-class). Every transfer fails; the run looks broken. Retry-later + reclaim covers it mechanically, but the UI must explain it's the token, not Distro.
- **Recipient is a contract that reverts on receipt.** try/catch handles it; the failure message should distinguish "recipient rejected" from "Distro failed."
- **Creator's balance drops below `totalAmount` between commit and fund.** `fund()` reverts — fine, but the dashboard should catch it before the wallet does.
- **Duplicate addresses within one distribution.** Legal by design; validation warns. Confirm the retry key `(chunkIndex, position)` handles the same address failing in two chunks independently — [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) M2.
- **`executeAfter` in the past at creation.** Should be legal (= execute now) — confirm it isn't accidentally rejected.
- **Zero-amount entries.** Harmless onchain (no-op transfer), wasteful in gas. Reject at import.
- **Very large single distribution** exceeding practical commit limits. Needs a defined ceiling and a clear error, not a wallet-level failure at tx 47 of 60.
- **Chain reorg between "paid" and the dashboard showing it.** Confirmation-depth requirement, already noted in DATABASE.md — make sure the UI's optimistic state respects it.

---

## Security

The contract-level findings are resolved in [CONTRACT_SPEC.md](CONTRACT_SPEC.md) v2. Standing items:

- **Supabase RLS is the whole access-control story** — policies are now specified in [DATABASE.md](DATABASE.md); they must ship with tests that _attempt_ cross-tenant access. A policy nobody tried to break is untested.
- **Service-role key never client-side.** `server-only` guards this today; keep it that way.
- **CSV upload** is an injection/DoS surface: formula injection, unbounded size, malformed encoding. Server-side validation is authoritative; client-side is UX.
- **Rate-limit** upload and commit-computation endpoints.
- **SIWE** — domain binding, nonce expiry, replay protection. Implemented; keep the library maintained.
- **Distro must never hold keys or funds beyond the escrow itself.** The keeper signs _executions_, never _transfers of custody_ — worth stating as an invariant in the ops runbook, since a keeper with a hot wallet is exactly where that line gets blurred under pressure.
- **Multisig on the factory from day one**, including testnet, to build the habit before it matters.

---

## Scalability

- **Contract**: chunked execution scales linearly; the ceiling is the creator's gas budget, not the design. Fine for the (corrected, P2) target scale.
- **Indexer**: the real scaling risk. A 5,000-recipient distribution emits 5,000 events in a short window. Bulk-insert, don't row-at-a-time; back-pressure the Realtime fan-out or the dashboard will melt on exactly the distributions that matter most.
- **Dashboard**: recipient tables need server-side pagination/filter/sort from day one — the indexes in [DATABASE.md](DATABASE.md) exist for this.
- **Monad's throughput is not the bottleneck.** Your indexer and your RPC provider's rate limits are. Choose the provider against the `monskills` `tooling-and-infra` list before load appears, not after.

---

## Recommendations, in order

1. **Ship the multisend MVP first (S1).** Escrow, keeper, indexer, and DA all exist to serve scheduling — which the stated problem never asks for. Validate bulk+tracking+retry with ~100 lines of contract and a cheap audit.
2. **Qualify or drop the airdrop claim (P2).** Push is the wrong economics above ~1,000 recipients. Say "community distributions", not "airdrops", or plan a claim mode as a distinct v2 product.
3. **Decide O1 and O2** ([CONTRACT_SPEC.md](CONTRACT_SPEC.md)) before any escrow work — both are immutable-contract shape decisions.
4. **Move notifications from v2 into the scheduling release (UX1).** Scheduling without an unfunded-warning is a payroll-miss generator.
5. **Cap exposure for the first mainnet weeks (S3).** Cheap now, impossible retroactively, and a trust signal rather than a weakness.
6. **Measure Monad gas before writing the contract.** `MIN_GAS_PER_TRANSFER` and chunk size are security parameters; guessed values make the griefing fix decorative.
7. **Settle monetization's _basis_ before the audit.** Not the rate — the basis. Per-recipient vs per-distribution vs volume changes where the hook lives.
8. **Write the RLS cross-tenant tests with the first migration**, not after the first table.
9. **Plan the calendar backwards from the audit.** It's 4–8 weeks of lead time and the only truly unparallelizable item.
