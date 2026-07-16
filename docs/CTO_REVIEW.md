# CTO Review — Distro Pre-Launch

Reviewed against the current [PRD](PRD.md), [FEATURES](FEATURES.md), [USER_FLOW](USER_FLOW.md), [CONTRACT_SPEC](CONTRACT_SPEC.md), [DATABASE](DATABASE.md), [API](API.md). Stack target: Next.js 15, React, TS, Tailwind, shadcn/ui, Wagmi, Viem, Foundry, Solidity, Supabase, on Monad mainnet.

None of this is implementation yet — this is the gap list to resolve before the blueprint is frozen.

> **Partially superseded (2026-07-15).** This review was written *before* the authoritative product definition arrived, against docs that described a claim-based Merkle/vesting product. Distro is actually a **push-based distribution engine** — the other docs have been rewritten; this one is kept as the standing risk register.
>
> **Still valid:** everything in Security concerns, Database improvements, Technical architecture, Landing page, Dashboard, and most Smart contract risks (SafeERC20, fee-on-transfer, ERC-777, single-EOA admin, gas griefing, Monad gas behavior).
>
> **Superseded:** anything referencing Merkle tree correctness/claim locking, vesting, recipient claim discovery, or the airdrop-first sequencing — §6 below is rewritten accordingly. Two gaps it raised (recipient notification, campaign correction) are now moot: recipients never transact, and a mis-entered address in a push model is an *irreversible send*, which is why validation and the review step are safety-critical in [FEATURES.md](FEATURES.md).
>
> The custody-vs-automation decision it did not anticipate is resolved in [CONTRACT_SPEC.md](CONTRACT_SPEC.md).

---

## 1. Missing product decisions

These block contract design and cannot be retrofitted cheaply after audit:

- **Monetization is undefined.** No fee model anywhere in the spec (protocol fee %, flat fee per campaign, subscription, free). This has to be decided *before* contracts are written — a fee-taking mechanism (e.g. `protocolFeeBps` + treasury address in the factory) is a contract-level decision, and adding it post-audit means re-auditing.
- **No team/org concept.** `users` keys off a single wallet address. Is DISTRO single-wallet-per-account, or does a company need multiple team members managing one campaign (view-only ops, an approver, etc.)? This is a normal B2B expectation and affects both DB schema and contract ownership model (who can call `recoverUnclaimed`?).
- **No compliance/sanctions posture.** Distributing tokens to arbitrary addresses on mainnet, at "production-ready startup" stakes, raises OFAC/sanctions-screening and securities-classification questions depending on what's being distributed and to whom. This needs a legal decision, not an engineering one — but it affects whether the product needs an address-screening step before claims are enabled.
- **Recipient discovery/notification is unsolved.** Nothing tells a recipient they're eligible except "post-v1 notifications." An airdrop nobody knows about doesn't get claimed. Needs at least an MVP notification path (email capture at creation? social share links? on-chain event watchers integrating with wallets?) before calling airdrop "done."
- **Campaign correction path is missing.** Once a Merkle root is deployed, it's immutable by design (correct, for security) — but there's no defined flow for "creator uploaded a bad CSV, campaign is wrong." Cancel-and-redeploy? Who eats the gas cost and the confusion of two claim links?
- **Fee-on-transfer / rebasing / non-standard ERC-20 tokens** aren't addressed. If a creator picks such a token, the amounts tracked in the Merkle tree and DB will drift from actual transferable balances. Decide: allow-list standard tokens only for v1, or explicitly test and support non-standard tokens?
- **Ownership/admin key model undecided.** Single EOA as factory owner is a single point of failure for a product holding real funds. Needs multisig from day one (even on testnet, to build the operational habit).
- **Pause/emergency-stop mechanism absent.** If a bug is found in an already-funded, live campaign, there's currently no way to stop draining without a full incident. Needs a scoped, transparent pause capability (blocks new claims only, cannot redirect funds) — or an explicit decision that immutability without pause is the accepted risk tradeoff.
- **Decimals/units convention undefined.** Is CSV `amount` in human units (e.g. `100.5`) or base units (`100500000000000000000`)? This ambiguity is a top cause of real-world airdrop bugs. Must be pinned down and enforced in both the upload validator and the Merkle leaf encoding.
- **Testnet → mainnet workflow undecided.** No staging environment, no canary/soft-launch plan mentioned. For a product whose entire pitch is "we don't lose your funds," a public testnet period with a real bug-bounty window before mainnet default should be part of the plan, not an afterthought.

## 2. UX gaps

- No defined **error/failure states**: wrong network, insufficient token balance, wallet rejection, RPC timeout, tx reverted. At "Stripe/Linear" polish tier, every one of these needs a designed state, not a generic toast.
- No **loading/pending/lag state** for the gap between "tx confirmed on-chain" and "indexer has updated the dashboard" — without an explicit "syncing…" state, users will think the claim failed and retry, wasting gas.
- **Mobile / WalletConnect flow** isn't specified. Recipients claiming from a wallet app browser or via WalletConnect deep link is a first-class path for airdrops, not an edge case.
- No **empty states** (zero campaigns, zero recipients, zero claims yet).
- No **CSV template/example** in the flow — "upload a CSV" assumes the user already knows the exact column format.
- No explicit **review/confirm step** before the deploy transaction that shows the full committed state (recipient count, total amount, Merkle root, deadline) with a clear "this is irreversible" moment — critical given root immutability.
- No **post-claim receipt** (explorer link, downloadable proof-of-claim) for recipients who need it for their own records/accounting.
- No plan for **large recipient tables** (search, filter, sort, pagination) — some campaigns will have thousands of rows.
- No **wrong-wallet-connected** handling: recipient connects wallet A, but the campaign link/allocation is for wallet B — needs a clear, non-scary explanation, not a silent "not eligible."
- Accessibility isn't mentioned despite the "enterprise-grade" bar — should be a stated requirement (WCAG AA minimum), not assumed.

## 3. Smart contract risks

Beyond what's already flagged in [CONTRACT_SPEC.md](CONTRACT_SPEC.md):

- **Fee-on-transfer / rebasing tokens** break the "amount tracked = amount transferable" assumption in both `MerkleAirdrop` and `VestingSchedule`. Either explicitly validate token behavior at campaign-creation time, or restrict to a vetted token list for v1.
- **Merkle root is immutable by design — but that means creator error is also permanent.** No update path, only cancel/redeploy. This must be a conscious, documented tradeoff, not a surprise discovered post-launch.
- **Gas griefing in `BatchPayout`** if a try/catch-per-recipient pattern is used: a malicious recipient contract with an expensive fallback can consume disproportionate gas. Needs explicit gas-forwarding limits per transfer (not the default 63/64 forward), and ideally push standard ERC-20 `transfer` (no external call risk) rather than sending native currency.
- **Non-standard ERC-20 return values** (tokens that don't return `bool`, e.g. some legacy tokens) will silently break naive `transfer()` calls — must use a safe-transfer wrapper (OpenZeppelin's `SafeERC20`), not raw `IERC20.transfer`.
- **Single EOA admin** on the factory (and on `recoverUnclaimed`/pause rights, if added) is a concentrated risk — needs multisig, stated explicitly in `CONTRACT_SPEC.md`, before audit.
- **No pausability currently designed** — see product decision above; if added, must be scoped so a paused contract can never redirect or seize already-claimable funds, only halt new state changes, and pause actions must emit loud on-chain events (no silent freezes).
- **ERC-777 / callback-capable tokens** should be explicitly excluded — hooks during transfer are a known reentrancy vector even with a guard on the calling function, since the guard doesn't protect against reentering a *different* function via the callback.
- Confirm **Monad gas-cost and precompile behavior** for the exact opcodes these contracts rely on (address recovery, batch loops) before assuming Ethereum-mainnet gas numbers hold — use the `monskills` reference rather than porting assumptions.

## 4. Security concerns (beyond contracts)

- **Supabase RLS is the whole ballgame here** — with wallet-address-based identity, RLS policies must strictly scope creators to their own campaigns and allow only the correctly-scoped anonymous reads for the public claim portal. This needs explicit policy review, not default-Supabase-project assumptions.
- **Never expose the Supabase service-role key client-side.** Privileged writes (campaign creation, status transitions) must go through a server layer (Next.js route handlers / edge functions), not direct client Supabase calls with elevated permissions.
- **CSV upload is an injection/DoS surface**: formula injection (CSV opened in Excel elsewhere), unbounded file size (resource exhaustion during Merkle generation), and malformed encoding all need server-side validation, not just client-side.
- **Rate limiting** is absent from the API spec — upload and Merkle-generation endpoints are computationally expensive and must be rate-limited/authenticated to prevent abuse.
- **SIWE (Sign-In with Ethereum) session handling** needs domain-binding, nonce expiry, and replay protection — standard but easy to get wrong; use a maintained library, don't hand-roll.
- **Indexer must be idempotent and single-writer-safe.** If the indexer process restarts or runs concurrently, duplicate event processing must not double-count claims — enforce via a unique constraint on `(tx_hash, log_index)`, not "hope it doesn't happen."
- **DISTRO itself must never custody creator private keys or funds beyond what's in the campaign contract itself** — worth stating explicitly as a security principle given "batch payout" implies someone/something executes transactions; that should always be the creator's own wallet, never a DISTRO-held key.

## 5. Database improvements

Current schema is a reasonable start but was written against generic Postgres, not Supabase specifically:

- **Design for Supabase's actual primitives**: RLS policies per table, Supabase Auth (or custom JWT via SIWE) for identity, Supabase Storage for raw CSV files (keep the original upload for audit/dispute resolution, not just parsed rows), Supabase Realtime for live dashboard updates instead of polling.
- **Add `chain_id` / `network`** to `campaigns` — mainnet vs testnet must be a first-class column, not inferred, to prevent an accidental cross-environment mixup in the dashboard.
- **Add idempotency key to `claim_events`**: unique constraint on `(tx_hash, log_index)` to make indexer reprocessing safe.
- **Store amounts in base units consistently** (bigint/numeric matching token decimals) with the token's `decimals` cached on `campaigns` for display conversion — don't let display-unit and base-unit values coexist ambiguously.
- **Add an `organizations`/`team_members` layer** if the missing team-account decision above resolves toward multi-user accounts.
- **Add an `audit_log` table** for creator/admin actions (campaign created, funded, paused, recovered) — expected for an "enterprise-grade" product and needed for support/dispute resolution.
- **Soft-delete, not hard-delete**, on campaigns and recipients — compliance and audit trails shouldn't be destructible by a UI action.

## 6. Feature prioritization

*(Rewritten against the real product — see the superseded notice above. Reflected in [ROADMAP.md](ROADMAP.md).)*

1. **Core distribution first** — create → import → validate → review → fund → execute now. This is the product; everything else is an enhancement of it. Get it audited-grade before adding surface area.
2. **Scheduling second.** It's the first pillar that differentiates Distro from a commodity multisend script, and it's cheap once escrow exists (`executeAfter` is one check). It's also what makes "payroll engine" true rather than aspirational.
3. **Tracking + retry third.** "Retry failed transfers" and "track payment status" are named pain points in the PRD's problem statement — they're core, not polish. But they depend on the indexer, which is the most operationally involved piece.
4. **Recurring automation deferred to v2.** It's the most-requested-sounding feature and the most dangerous to rush: repeat funding and cycle state materially expand the contract's audit surface. Ship scheduled-once first; a "duplicate this distribution" convenience covers most of the value at a fraction of the risk.
5. **Monetization must be decided before the audit**, even if launched at zero — the contracts ship with a fee hook precisely so this doesn't force a re-audit later.
6. **Team accounts** are reasonable to defer, but decide now whether they're coming: retrofitting an `organizations` layer under `distributions` later is a migration, not a feature.

## 7. Technical architecture improvements

- **The indexer needs a real home.** It can't be a Vercel serverless function (no persistent event listening) — deploy it as a long-running service (Fly.io, Railway, a small dedicated VM) watching logs via `viem`, with reorg-safety (confirmation depth before writing) and a periodic on-chain reconciliation job as the spec already notes.
- **Use a proper monorepo layout**: `apps/web` (Next.js — marketing, dashboard, and claim portal as route groups in one app, or split if the marketing site needs independent deploy cadence), `apps/indexer` (the standalone service above), `contracts/` (Foundry project), `packages/` (shared TS types generated from contract ABIs via `wagmi`'s codegen, shared config/UI).
- **CI gates**: Foundry unit + fuzz tests and a static analyzer (Slither or similar) required on every contract PR; typecheck/lint/build required on every frontend PR. No merges to main that skip these, given the funds at stake.
- **Environment separation**: distinct Supabase projects and distinct contract deployments for testnet/staging vs mainnet, selected via environment config — never a runtime toggle that could point a production session at the wrong chain.
- **Observability from day one**: error tracking (Sentry or equivalent) on both frontend and indexer, plus on-chain monitoring/alerting for anomalous activity (e.g. a `recoverUnclaimed` call, unusually large batch payout) — expected baseline for infra handling real funds.
- **Client-side Merkle generation should move server-side (or at minimum be mirrored server-side)** for large recipient lists — don't rely solely on the browser for tree construction on thousands of rows; keep a client-side spot-check for user trust, but generate authoritatively on the server.

## 8. Landing page improvements

Against the stated Stripe/Linear/Mercury/Vercel bar:

- Clear above-the-fold value proposition with one primary CTA — infra products convert on clarity, not marketing flourish.
- A "how it works" 3-step visual (create → fund → recipients claim) in the Stripe explainer style.
- A dedicated **`/security` page**: audit report/status, verified contract source links, bug bounty program (even if minimal at launch) — for a product holding real money, this page matters more than most marketing content.
- Trust signals section (once real: audit badge, notable users) rather than empty placeholders.
- Docs-first information architecture (Linear/Vercel pattern) — a real docs subdomain/section, not just marketing copy.
- Pricing page — blocked on the monetization decision above.
- Full dark/light mode support — table stakes at this design tier.

## 9. Dashboard improvements

- Persistent, unmissable **network/environment indicator** (testnet vs mainnet) — given real-money stakes, accidental mainnet actions must be hard to do by mistake.
- **Realtime updates** (Supabase Realtime) instead of polling for claim/release status.
- **Command palette** (cmd+k) — expected at this polish tier (Linear-style).
- **Per-campaign audit trail/timeline** (created, funded, deployed, key events) visible in the UI, not just in logs.
- **Org/team switcher** if the team-account decision lands that way.
- **Exportable reports** (CSV/PDF) for creators' own compliance/accounting recordkeeping.
- **Direct block-explorer links** surfaced per campaign/transaction, not buried.

---

## Proposed production architecture (summary)

```
distro/
├── apps/
│   ├── web/            # Next.js 15 — marketing + dashboard + claim portal (route groups)
│   └── indexer/         # Long-running service (NOT serverless) — viem log watcher, reorg-safe, reconciliation cron
├── contracts/            # Foundry — DistroFactory, MerkleAirdrop, VestingSchedule, BatchPayout
├── packages/
│   ├── contract-types/   # ABI-generated TS types (wagmi codegen)
│   └── ui/                # Shared shadcn/ui-based components (if marketing/app split later)
└── docs/
```

- **Auth**: SIWE → server-issued JWT compatible with Supabase RLS (wallet address as the identity claim).
- **Data flow**: contracts emit events → indexer (persistent service) watches logs with confirmation-depth safety → idempotent upserts into Supabase (unique on `tx_hash` + `log_index`) → dashboard reads via RLS-scoped Supabase client + Realtime subscriptions → periodic reconciliation job re-verifies indexed state against direct chain reads.
- **Admin/ownership**: multisig-controlled factory from day one (testnet included), no single EOA with privileged rights on anything touching mainnet funds.
- **Fee mechanism**: designed into the factory/campaign contracts now (even if set to zero at launch) so monetization doesn't require a post-audit contract change.
- **Environments**: fully separated testnet/staging vs mainnet — separate Supabase projects, separate deployed contract addresses, no shared state.
- **CI/CD**: Foundry fuzz + static analysis gate on contracts; typecheck/lint/build gate on frontend; both required before merge.

---

## Open questions before the blueprint can be finalized

1. Monetization model — fee mechanism and rate?
2. Single-wallet accounts, or team/org accounts for v1?
3. What's the compliance posture — any address screening required before claims?
4. Non-standard token support (fee-on-transfer, rebasing) — supported or explicitly excluded in v1?
5. Emergency pause — included in v1 contracts, or accepted as a risk tradeoff for full immutability?
6. Recipient notification — what's the MVP mechanism for v1, given "post-v1" leaves airdrops undiscoverable?

Once these are answered, I'll turn this into the frozen implementation blueprint (contract interfaces, DB schema final pass, page-by-page UI spec) before any code is written.
