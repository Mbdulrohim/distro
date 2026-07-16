# Implementation Roadmap — Distro

Feature-by-feature build plan. Each feature is self-contained: an engineer should be able to pick one whose dependencies are met and build it without reading the whole conversation history. Grounded in [ARCHITECTURE.md](ARCHITECTURE.md), [CONTRACT_ARCHITECTURE.md](CONTRACT_ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [UX_SPEC.md](UX_SPEC.md), [WIREFRAMES.md](WIREFRAMES.md), [DESIGN.md](../DESIGN.md).

**Status:** ✅ done · 🔨 next · ⬜ not started · 🔒 blocked (dependency or decision).

## Build order & dependencies

```
F0 Scaffold ✅
F1 Auth (SIWE) ✅
F2 Multisend contract ✅
   │
   ├─ F3 Testnet deploy + gas calibration 🔨 ── (blocks F11)
   ├─ F4 Tier-1 DB + RLS 🔨 ─────────────┐
   ├─ F5 App shell & nav 🔨               │
   └─ F7 CSV validation engine ⬜          │
                                          ▼
                         F6 Distribution data layer (API) ⬜
                                          │
   F8 Create·Details ─ F9 Create·Import ─ F10 Create·Review ─ F11 Create·Send ⬜
                                          │
              F12 Dashboard list ── F13 Details + Retry ── F14 History ── F15 Receipts ⬜
                                          │
                             F16 Settings ⬜     F17 Landing polish ⬜
                                          │
   ── Tier 2 ──  F18 Indexer · F19 Escrow · F20 Scheduling · F21 Templates · F22 Notifications 🔒
```

Everything F4–F17 (the whole MVP UI) requires **no contract changes** — F2 is final for the MVP. That single fact removes most of the guesswork: UI work cannot be blocked on Solidity.

---

## F3 — Multisend testnet deploy + gas calibration 🔨

**Goal.** Deploy `Multisend` to Monad testnet, verify it, and replace the placeholder `MIN_GAS_PER_TRANSFER` with a measured value. Produce the real per-recipient gas cost that the frontend's batch-sizing uses.

**Dependencies.** F2.

**Files.**

- `contracts/script/DeployMultisend.s.sol` (new) — Foundry deploy script (Safe-aware; see monskills `wallet`).
- `contracts/test/Multisend.gas.t.sol` (exists) — extend to run against a Monad fork.
- `contracts/deployments/monad-testnet.json` (new) — record address + block.
- `web/src/config/contracts.ts` (new) — export the deployed address per chain.

**Smart contract changes.** Update `MIN_GAS_PER_TRANSFER` to the measured value; re-run the full suite. No logic change.

**Database changes.** None.

**Frontend changes.** `contracts.ts` exposes `MULTISEND_ADDRESS` keyed by chain id; nothing consumes it yet.

**Testing.**

- Fork test against a Monad RPC measuring real per-transfer gas for a standard ERC-20.
- Re-run `forge test` (31 tests) green after the constant change.
- Manual: one real testnet distribution to 3 addresses; confirm `Paid` events in the receipt.

**Definition of Done.** Contract deployed + verified on all Monad explorers; address committed to `deployments/` and `contracts.ts`; `MIN_GAS_PER_TRANSFER` is measurement-backed with the measurement in a test comment; the "×4 extrapolation is invalid" note resolved with a real number.

---

## F4 — Tier-1 database + RLS 🔨

**Goal.** Create the MVP schema (`users`, `distributions`, `distribution_transactions`, `recipients`) with RLS policies and cross-tenant tests.

**Dependencies.** F1 (JWT carries the wallet address RLS keys on).

**Files.**

- `supabase/migrations/0001_tier1_schema.sql` (new).
- `supabase/migrations/0002_rls_policies.sql` (new).
- `supabase/tests/rls.test.sql` (new) — cross-tenant attack tests.
- `web/src/lib/db/types.ts` (new) — generated/typed row shapes.

**Smart contract changes.** None.

**Database changes.** All four Tier-1 tables per [DATABASE.md](DATABASE.md): enums (`distribution_status`, `transaction_status`, `recipient_status`), FKs (cascade dist→children, restrict user→dist), the unique constraints, the `amount <= 2^128-1` and `token_decimals 0..36` checks, and every index in the Tier-1 rows of the index table. RLS enabled on all four; policies keyed on `auth.jwt() ->> 'address'` (citext-compared).

**Frontend changes.** None (types only).

**Testing.**

- RLS: a JWT for wallet A cannot select/update wallet B's distributions, transactions, recipients (the attack tests must _fail to read_).
- Constraint tests: `amount = 2^128` rejected; duplicate `(user, salt)` rejected; duplicate `(distribution, batch, index)` rejected; same `(distribution, address)` twice _accepted_.
- Cascade/restrict: deleting a distribution removes its recipients; deleting a user with distributions is blocked.

**Definition of Done.** Migrations apply cleanly on a fresh Supabase project; RLS on for every table; anon client has no write grant on state-transitioning columns; cross-tenant tests are in CI and green; a deliberately malformed insert is rejected by a check, not stored.

---

## F5 — App shell & navigation 🔨

**Goal.** The authenticated frame every page renders inside: header, primary nav, wallet/network control, theme, wrong-network banner. Implements DESIGN.md tokens.

**Dependencies.** F1.

**Files.**

- `web/src/app/globals.css` (edit) — wire semantic tokens; **remove the leftover `sidebar-primary` purple** (DESIGN.md Don't).
- `web/src/components/layout/app-header.tsx` (exists — extend: nav links, wallet menu).
- `web/src/components/layout/network-banner.tsx` (new) — blocking wrong-network banner.
- `web/src/components/layout/nav.tsx` (new) — Dashboard · History · Templates.
- `web/src/components/ui/*` (add via shadcn: `dropdown-menu`, `badge`, `table`, `dialog`, `sonner`, `skeleton`, `input`, `select`).
- `web/src/components/theme-provider.tsx` (new) — light/dark/system.

**Smart contract changes.** None.

**Database changes.** None.

**Frontend changes.** Header shows the wallet chip state machine (Loading → Connect → Check your wallet → address · Disconnect); network indicator silent on 143, blocking banner otherwise with one-click switch; Receipts/Settings under the wallet `▾`; theme toggle. Applies status-badge, button, and z-index vocabularies from DESIGN.md.

**Testing.**

- Component tests: header renders each wallet state; banner appears only off-mainnet.
- a11y: keyboard-navigable nav + menu; focus-visible rings; `prefers-reduced-motion` respected.
- Contrast check on the wired tokens (AA).

**Definition of Done.** Every authenticated route renders inside the shell; wrong-network is impossible to miss and one click to fix; the shadcn components needed downstream are installed; no leftover crypto-purple token; light/dark both pass AA.

---

## F6 — Distribution data layer (API routes) ⬜

**Goal.** Server routes and typed client for creating/reading distributions and their recipients — the boundary between UI and Supabase.

**Dependencies.** F4.

**Files.**

- `web/src/app/api/distributions/route.ts` (POST create draft, GET list).
- `web/src/app/api/distributions/[id]/route.ts` (GET detail, DELETE draft).
- `web/src/app/api/distributions/[id]/recipients/route.ts` (GET paginated).
- `web/src/app/api/distributions/[id]/transactions/route.ts` (POST record a submitted tx, PATCH status).
- `web/src/app/api/uploads/csv/route.ts` (POST parse+validate+store).
- `web/src/lib/distributions/queries.ts` + `mutations.ts` (typed client, react-query hooks).
- `web/src/lib/validation/distribution.ts` (shared zod schemas).

**Smart contract changes.** None.

**Database changes.** None (consumes F4). All privileged writes use the server client, never the anon client.

**Frontend changes.** react-query hooks (`useDistributions`, `useDistribution`, `useCreateDistribution`, …) — consumed by F8–F14.

**Testing.**

- Route tests: create returns a draft scoped to the caller; another wallet's id 404s (RLS-backed).
- Idempotency: re-POSTing a confirmed tx hash doesn't duplicate rows.
- Validation: server rejects payloads the client would (defense in depth); CSV endpoint rejects formula-injection and oversize.
- Every onchain-derived response includes `lastIndexedBlock`/freshness marker.

**Definition of Done.** All routes RLS-scoped and rate-limited (upload/parse); zod at every boundary; hooks typed end-to-end; no anon-client privileged write path exists.

---

## F7 — CSV import & validation engine ⬜

**Goal.** Pure, well-tested library that turns a CSV/pasted list into validated recipient rows + the canonical payload bytes. Reused by client (instant UX) and server (authority).

**Dependencies.** None (pure TS); pairs with F6's server use.

**Files.**

- `web/src/lib/recipients/parse.ts` — CSV/paste → rows.
- `web/src/lib/recipients/validate.ts` — address/amount/dupe/balance/`uint128` checks → structured results.
- `web/src/lib/recipients/encode.ts` — rows → `address‖uint128` payload (the normative encoding), + batch splitter by gas budget.
- `web/src/lib/recipients/*.test.ts`.

**Smart contract changes.** None — but `encode.ts` must match `Multisend`'s payload format byte-for-byte.

**Database changes.** None.

**Frontend changes.** None directly (consumed by F9/F11).

**Testing.**

- Unit: valid/invalid addresses, decimals→base-units round-trip, amounts over `uint128`, zero amounts, duplicates, whitespace/BOM/CRLF, huge files.
- **Cross-check against Solidity:** encode a payload in TS, assert it hashes/decodes identically to the contract (a Foundry differential test or a fixture shared with `Multisend.t.sol`).
- Batch splitter: N recipients → correct batch count for a given per-transfer gas + block budget.

**Definition of Done.** Human-unit → base-unit conversion is exact and property-tested; the TS encoder and the Solidity decoder agree on a shared fixture; batch sizes derive from F3's measured gas, not a constant guess.

---

## F8 — Create Distribution · Step 1 Details ⬜

**Goal.** Name the distribution; resolve and validate the ERC-20 token (symbol, decimals, balance) from chain.

**Dependencies.** F5, F6, F7, wagmi/viem.

**Files.**

- `web/src/app/(dashboard)/dashboard/new/page.tsx` (new — hosts the whole stepped flow).
- `web/src/components/create/step-details.tsx`.
- `web/src/lib/tokens/useToken.ts` (read symbol/decimals/balance; detect non-contract; heuristics for fee-on-transfer).
- `web/src/components/create/step-rail.tsx`.

**Smart contract changes.** None.

**Database changes.** Creates a `draft` distribution row on first save (via F6).

**Frontend changes.** Token field resolves live; shows symbol/decimals/balance; blocks on not-an-ERC20 and unsupported-token; autosaves draft; Continue gated on resolution.

**Testing.** Token resolves for a standard ERC-20; non-contract address errors; draft persists across reload; unsupported-token path blocks with explanation.

**Definition of Done.** Matches WIREFRAMES §3 Step 1; draft row created and resumable; all four token states (resolving/resolved/not-token/unsupported) designed and handled.

---

## F9 — Create Distribution · Step 2 Import ⬜

**Goal.** Import recipients (CSV/paste), preview, and run inline validation.

**Dependencies.** F7, F8.

**Files.**

- `web/src/components/create/step-import.tsx`.
- `web/src/components/recipients/recipient-table.tsx` (virtualized; reused in Details).
- calls `web/src/app/api/uploads/csv` (F6) for authoritative parse + Storage of the original.

**Smart contract changes.** None.

**Database changes.** Writes `recipients` rows (via F6) tied to the draft; stores original CSV in Supabase Storage; sets `recipient_count`, `total_amount`.

**Frontend changes.** Drop/choose/paste; template download; virtualized preview with per-row status; edit/remove rows; running count + total.

**Testing.** Large file (10k rows) stays responsive; malformed file errors gracefully; row edits persist; totals recompute correctly.

**Definition of Done.** Matches WIREFRAMES §3 Step 2; original upload retained for audit; validation runs and surfaces per-row status; virtualization holds at 10k rows.

---

## F10 — Create Distribution · Step 3 Review ⬜

**Goal.** Surface all validation results and the committed summary; gate on the irreversibility acknowledgement.

**Dependencies.** F9.

**Files.**

- `web/src/components/create/step-review.tsx`.
- `web/src/components/create/validation-summary.tsx`.

**Smart contract changes.** None.

**Database changes.** None (reads the draft).

**Frontend changes.** Grouped errors (expandable to rows, fixable inline) block; duplicates warn; summary shows recipients, total in **both** unit representations, token, batch count + est. gas, balance-covers check; irreversibility statement + checkbox gate; test-payment offer.

**Testing.** Continue disabled until errors clear AND checkbox ticked; insufficient balance blocks with shortfall; both unit representations shown and correct; duplicates warn but don't block.

**Definition of Done.** Matches WIREFRAMES §3 Step 3; the checkbox+clean-errors gate is enforced; the test-payment path exists; no way to reach Send with unresolved errors.

---

## F11 — Create Distribution · Step 4 Send (execution) ⬜

**Goal.** Drive approve → distribute (one or more txs), show honest submitted/confirmed progress, and record results parsed from receipts. **No indexer.**

**Dependencies.** F3 (address + gas), F10.

**Files.**

- `web/src/components/create/step-send.tsx`.
- `web/src/lib/distributions/execute.ts` (approve, then per-batch `distribute`; parse `Paid`/`PaymentFailed` from each receipt).
- `web/src/lib/distributions/receipt.ts` (decode events → recipient status updates).
- writes via F6 (`transactions`, `recipients.status`).

**Smart contract changes.** None (calls F2/F3).

**Database changes.** Inserts `distribution_transactions` rows; updates `recipients.status`/`paid_at`/`failure_reason` and `distributions.status` from receipts.

**Frontend changes.** Two designed phases; per-tx `submitted` vs `confirmed` always distinct with hash + explorer link; live tally; mid-run rejection states who is/isn't paid; on completion → Distribution Details.

**Testing.**

- E2E on testnet fork: 3 recipients incl. one guaranteed-fail (blocklist mock) → 2 paid / 1 failed reflected in DB.
- Batching: a list forcing 2 txs runs both; partial completion if the second is rejected.
- Receipt parse maps every event to the right row by `index_in_batch`.

**Definition of Done.** Matches WIREFRAMES §3 Step 4; results come only from receipts (no indexer); submitted≠confirmed enforced visually; DB reflects true per-recipient outcomes; interrupted runs are recoverable/resumable.

---

## F12 — Dashboard list ⬜

**Goal.** The working home: needs-attention band, recent distributions, new-distribution CTA, empty state.

**Dependencies.** F6.

**Files.** `web/src/app/(dashboard)/dashboard/page.tsx` (replace placeholder); `web/src/components/dashboard/{distribution-row,attention-band,empty-state}.tsx`.

**Smart contract changes.** None. **Database changes.** None (reads).

**Frontend changes.** Table with status badges; attention band for failures/drafts; skeleton loading; teaching empty state; row→Details, draft→resume, `···` menu (duplicate/template/delete).

**Testing.** Empty vs populated vs loading vs error; attention band only when warranted; row routing correct.

**Definition of Done.** Matches WIREFRAMES §2; all four list states designed; server-side pagination.

---

## F13 — Distribution Details + Retry ⬜

**Goal.** The record of a distribution and the remedy for failures.

**Dependencies.** F11.

**Files.** `web/src/app/(dashboard)/dashboard/[id]/page.tsx`; `web/src/components/distribution/{summary,failed-band,recipient-table,detail-actions}.tsx`; retry reuses F10/F11 scoped to failures.

**Smart contract changes.** None. **Database changes.** None (retry writes via F11).

**Frontend changes.** Summary tiles; all-paid/partial/all-failed states; failed rows with honest reasons; Retry → scoped Review→Send (same irreversibility gate); export CSV; filter failures-only; explorer links.

**Testing.** Each result state renders; retry pays only the failed subset and never double-pays; export contains failed rows marked.

**Definition of Done.** Matches WIREFRAMES §4; retry is scoped and idempotent; partial failure reads as routine-with-remedy, not an error screen.

---

## F14 — History ⬜

**Goal.** Searchable/filterable archive of every distribution + bulk export.

**Dependencies.** F6, F12.

**Files.** `web/src/app/(dashboard)/history/page.tsx`; `web/src/components/history/{filters,history-table}.tsx`.

**Smart contract changes.** None. **Database changes.** None (uses Tier-1 indexes).

**Frontend changes.** Search + token/status/date filters; sortable, server-paginated; filtered-set CSV export; empty-filter state.

**Testing.** Filters compose; pagination correct at 40+ rows; export matches the active filter.

**Definition of Done.** Matches WIREFRAMES §5; queries hit the indexes; export reflects filters.

---

## F15 — Receipts ⬜

**Goal.** Formatted, exportable proof-of-distribution (index + single receipt, CSV/PDF/print).

**Dependencies.** F13.

**Files.** `web/src/app/(dashboard)/receipts/page.tsx` + `[id]/page.tsx`; `web/src/lib/receipts/{toCsv,toPdf}.ts`; `web/src/components/receipts/receipt-view.tsx`.

**Smart contract changes.** None. **Database changes.** None (formatted view over completed distributions).

**Frontend changes.** Index list; single receipt with from/token/date/totals/tx hashes + full recipient ledger incl. failures; CSV + PDF/print.

**Testing.** Receipt totals reconcile with the distribution; failed rows present and marked; PDF renders; CSV parses.

**Definition of Done.** Matches WIREFRAMES §8; every line traceable to a tx; failures included (truthful receipt).

---

## F16 — Settings ⬜

**Goal.** Thin account/preferences surface.

**Dependencies.** F5.

**Files.** `web/src/app/(dashboard)/settings/page.tsx`; `web/src/lib/prefs/usePreferences.ts` (localStorage; email row disabled in MVP).

**Smart contract changes.** None. **Database changes.** None in MVP (prefs local; email is Tier 2 → a `notification_prefs` table later).

**Frontend changes.** Wallet/network display + disconnect; theme; amount-display (human/base); explorer choice; disabled notifications row; export-all-history.

**Testing.** Prefs persist; theme applies; disconnect returns to Landing.

**Definition of Done.** Matches WIREFRAMES §7; no password/billing/API-key surfaces; wrong-network mirrors the global banner.

---

## F17 — Landing polish ⬜

**Goal.** Finish the public sign-in surface to DESIGN.md.

**Dependencies.** F1.

**Files.** `web/src/app/(marketing)/page.tsx` (extend); `web/src/components/marketing/{hero,how-it-works,security-note}.tsx`; `web/src/app/(marketing)/security/page.tsx`.

**Smart contract changes.** None. **Database changes.** None.

**Frontend changes.** Hero + one CTA; 3-step how-it-works; security note + `/security` page (audit status, verified contract link, non-custodial claim); redirected-here notice; all connect states inline.

**Testing.** Connect states render; redirect param forwards post-auth; security page links resolve; responsive at all breakpoints.

**Definition of Done.** Matches WIREFRAMES §1; no marketing-slop (no eyebrows, no gradients, no purple); one primary action; `/security` exists.

---

## Tier 2 (lower detail; unblock as decisions land) 🔒

Each needs the escrow decisions in [ROADMAP.md](ROADMAP.md) (O1 irrevocable, O2 incentive, O3 recurring shape) and/or the monetization basis. Full field-by-field specs to be written when they're next, not now — sequencing only:

- **F18 Indexer** — standalone long-running service; watches escrow events; reorg-safe, idempotent (`(tx_hash, log_index)`); reconciliation job; rebuild-from-chain. _Dep: F19._
- **F19 Escrow contracts** — `DistributionFactory` + `Distribution` per [CONTRACT_SPEC.md](CONTRACT_SPEC.md); the invariant + fuzz suite; **external audit**. _Dep: O1/O2, F3 gas._
- **F20 Scheduling UI** — `executeAfter`, fund-decoupled flow, cancel/reclaim, the **unfunded-scheduled warning** (UX_SPEC's sharpest edge), timezone-safe pickers. _Dep: F19, F18._
- **F21 Templates** — saved recipient lists; "Use" seeds Create at Import; never auto-pays. _Dep: F9; DB `templates` + `template_recipients`._
- **F22 Notifications** — email on complete/failure and unfunded-scheduled; `notification_prefs` table; worker. _Dep: F18/F20._

---

## How to use this roadmap

1. Pick any feature whose dependencies are ✅.
2. Build strictly to its eight fields; if a field says "None," that's a guarantee, not an omission (e.g. no MVP UI feature touches Solidity).
3. A feature is not done until its **Definition of Done** checklist passes _and_ CI (F0's `ci.yml`: forge fmt/build/test + web lint/typecheck/build) is green.
4. When a field is under-specified for a decision you hit, it belongs in one of the open decisions in [ROADMAP.md](ROADMAP.md) — resolve it there, don't guess inline.
