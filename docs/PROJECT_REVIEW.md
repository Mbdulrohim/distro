# Project Review — Distro, 2026-07-16

Staff engineer + product designer review of the implementation against [PRD.md](PRD.md) and the documentation set. Audited against the actual repo, not memory.

**Verdict up front: this is not yet an MVP.** It is an unusually well-built _draft manager_ for distributions. The one thing the product exists to do — move money — cannot happen. §5 explains why that's a single blocker rather than a long list.

---

## 1. What is implemented

### Contracts — the strongest part of the project

| Contract                | State                     | Tests                 |
| ----------------------- | ------------------------- | --------------------- |
| `Multisend`             | Complete, gas-calibrated  | 26                    |
| `Distribution` (escrow) | Complete                  | 42                    |
| `DistributionFactory`   | Complete                  | (covered above)       |
| `PayloadLib`            | Complete, shared encoding | encoding parity suite |

**79 tests, 75 passing, 4 skipped** (the fork tests skip without an RPC — by design, so CI can't fail on a network blip).

Substantive, not superficial:

- **`MIN_GAS_PER_TRANSFER` is measured, not guessed** — 31,471 gas/recipient against real USDC on a Monad mainnet fork; the 100k floor carries ~3.2× headroom. The "×4 for Monad cold access" extrapolation was tested and **disproved** (real ≈ 1.1× local).
- **TS↔Solidity payload parity** is enforced by a shared fixture — the encoder and decoder cannot silently drift.
- Non-standard ERC-20s handled (USDT-class no-return, `false`-return, garbage-return); per-recipient failure isolation; reentrancy proven blocked non-vacuously.
- Escrow: onchain data availability via `RecipientsCommitted`, permissionless execution, position-keyed retry, cancel-while-unexecuted, post-grace reclaim.

### Auth — complete

SIWE → stateless JWT cookie, mainnet-bound, Edge-verified middleware + server-side re-verification, persistent wrong-network guard, user provisioning on sign-in.

### Data — live and verified

Supabase project up; Tier-1 schema applied. Verified _by probing the real database_, not by assuming the SQL ran: RLS enforcing, anon writes blocked (401), `uint128` cap exact at **both** boundaries, duplicate addresses allowed (by design), position collisions rejected, cascade clean.

### Frontend — real, and wired

Landing, dashboard (real aggregates), create flow (`/dashboard/new`: token → recipients → review → save). **56 tests.** Every component now has a page; nothing is orphaned. Verified by driving a live server: guards 307, unauthenticated API 401s, no server errors.

### The input pipeline — production-grade

CSV/paste/manual entry, address + amount validation, duplicate detection with opt-in merge, human↔base-unit conversion with BigInt throughout (a test proves `Number` cannot distinguish _x_ from _x+1_ at 18-decimal magnitudes).

### Documentation — 16 documents

PRD, architecture (system + contract), database, UX spec, wireframes, design system, roadmap, and the review/decision records. Genuinely load-bearing: the reviews caught the fake-permissionless-execution flaw and the scope error before either reached code.

---

## 2. What is partially implemented

| Area                | Built                                                               | Missing                                                                                                                               |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Create flow**     | Token → recipients → review → **save draft**                        | The send. Terminates at a draft.                                                                                                      |
| **Dashboard**       | Real counters, totals-by-token, recent activity, empty state        | Row → detail (no detail page exists)                                                                                                  |
| **Scheduling**      | Full escrow contracts + schedule model/validation, both tested      | Hardcoded `mode: "now"` in the UI; no date picker; factory never deployed or called                                                   |
| **RLS**             | Policies written, applied, enforcing against anon                   | **Not load-bearing** — the SIWE JWT isn't presented to Supabase as its access token. Security currently rests on server-side scoping. |
| **Token selection** | Registry, on-chain resolution, balances, insufficient-balance check | Registry addresses **never verified on-chain** (`verify:tokens` blocked by DNS). Must pass before mainnet.                            |
| **API**             | `POST /api/distributions`, full auth surface                        | No GET/PATCH/DELETE; dashboard reads bypass the API via server-side lib                                                               |

---

## 3. What is missing

**Blocking the product:**

1. **Deployment.** No contract is deployed. `contracts.ts` returns `undefined` by design. `deployments/*.json` doesn't exist.
2. **Execution.** `lib/distributions/` does not exist. No approve → distribute → parse-receipt path. **This is the product.**
3. **Distribution detail page** (`/dashboard/[id]`). Nothing to open; no per-recipient results.
4. **Retry.** Contract supports it; no UI, no client path.

**Required before mainnet:** 5. **External audit** — non-negotiable per the PRD's "zero funds lost" bar; 4–8 weeks lead time and the only unparallelizable item. 6. **Token registry on-chain verification.** 7. **SIWE↔Supabase JWT wiring**, to make RLS actually bite.

**Deferred, correctly:** 8. History, Receipts, Settings, Templates pages. 9. Indexer (Tier 2 — the MVP needs none: the execution receipt carries every event). 10. Keeper service, notifications, escrow frontend.

**Unresolved decisions:** monetization basis; airdrop scope (push is wrong economics >~1k recipients); team accounts; compliance screening; native MON (deferred — WMON covers it via the WETH pattern).

---

## 4. What to build next

**One thing: deploy, then execute.** In that order, and nothing else first.

The gap between here and a working product is narrow and specific. Everything upstream of the send is built and tested: a user can pick a token, import 500 recipients, catch every bad address, review the exact total, and save. Then it stops — at the only step that matters.

Nothing else on the list changes that. History, receipts, settings, and scheduling UI are all polish on a product that cannot yet perform its function. **Deploy `Multisend`, wire execution, ship the detail page** — that is the MVP, and it is roughly a week of work, not a quarter.

---

## 5. Is this an MVP?

**No — and it's one blocker, not a long tail.**

Against the PRD's own success metrics:

| PRD metric                                                    | Status                                              |
| ------------------------------------------------------------- | --------------------------------------------------- |
| "Connect wallet → distribution executing in under 10 minutes" | ❌ Cannot execute at all                            |
| "Execution success rate > 99%"                                | ❌ No executions exist                              |
| "Zero funds lost to contract bugs"                            | ⚠️ Vacuously true — no funds have moved. Unaudited. |
| "A scheduled run executes even if Distro is down"             | ⚠️ Contract guarantees it; never deployed           |

The PRD defines Distro as _"an onchain distribution engine… teams create a distribution, import recipients, select a token, choose when to execute, approve — Distro executes onchain and tracks every payment."_ Steps 1–3 work. Step 4 is hardcoded. Step 5 doesn't exist.

**What it honestly is today:** a rigorously engineered, well-documented distribution _drafting_ tool with production-grade contracts that have never touched a live chain.

**The distance to MVP is short.** The hard parts — the contracts, the gas number, the validation pipeline, the schema, the auth — are done and verified. What remains is a deploy command and the execution wiring. That's the entire gap.

---

## 6. Prioritized task list

### P0 — Blocks MVP

| #   | Task                                                 | Notes                                                                                                                           |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Deploy `Multisend` to testnet**                    | Deployer wallet funded (10 MON, nonce 0). Runbook written. Contract has no owner, so a Safe isn't required _for this contract_. |
| 2   | **Record the address**                               | `deployments/monad-testnet.json` + `contracts.ts`, same commit — drift means the app calls the wrong contract.                  |
| 3   | **Add testnet as a staging environment**             | App is mainnet-only by design (Feature 1). Needed to exercise the flow pre-audit. ARCHITECTURE.md already calls for it.         |
| 4   | **Build execution** (`lib/distributions/execute.ts`) | approve → batched `distribute` → parse `Paid`/`PaymentFailed` from receipts. **No indexer needed.**                             |
| 5   | **Distribution detail page** (`/dashboard/[id]`)     | Per-recipient results, tx links, failure reasons.                                                                               |
| 6   | **Retry failed subset**                              | Contract-ready; scoped re-run through review→send.                                                                              |
| 7   | **End-to-end on testnet**                            | One real distribution incl. a deliberate failure; confirm DB matches chain.                                                     |

### P1 — Blocks mainnet

| #   | Task                                                             |
| --- | ---------------------------------------------------------------- |
| 8   | **External audit** of `Multisend` (start early — long lead time) |
| 9   | **Verify token registry on-chain** (`verify:tokens` must pass)   |
| 10  | **SIWE↔Supabase JWT** so RLS is load-bearing, not decorative     |
| 11  | **Per-distribution size cap** for the first mainnet weeks        |
| 12  | **Decide monetization basis** before the escrow audit            |

### P2 — Completes the MVP experience

| #   | Task                                                                                          |
| --- | --------------------------------------------------------------------------------------------- |
| 13  | History page (data + indexes already exist)                                                   |
| 14  | Receipts (CSV/PDF)                                                                            |
| 15  | Settings                                                                                      |
| 16  | Landing polish + `/security` page                                                             |
| 17  | Wire the `warning`/`success` design tokens (removes the "uses tokens that exist" compromises) |
| 18  | Qualify or drop the airdrop claim (push economics fail >~1k recipients)                       |

### P3 — Tier 2

| #   | Task                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------ |
| 19  | Deploy escrow + factory (audit first)                                                                                          |
| 20  | Scheduling UI (date picker, timezone-safe)                                                                                     |
| 21  | **Notifications** — ship _with_ scheduling, not after: an unfunded scheduled run silently no-ops and the chain gives no signal |
| 22  | Indexer (long-running; cannot be serverless)                                                                                   |
| 23  | Keeper + the always-available manual path                                                                                      |
| 24  | Templates                                                                                                                      |

---

## Closing note

The engineering discipline here is genuinely above average for a pre-launch product: the gas constant is measured rather than guessed, the encoder is proven identical across two languages, the schema was probed rather than assumed, and two design reviews caught a fake security guarantee and a scope error before either cost anything.

The risk is not quality. **The risk is that none of it has touched a live chain.** Every property above is proven in a fork or a test. Until one real distribution executes on a real network, the product is theoretical — and that single step is the whole remaining distance to an MVP.
