# Architecture — Distro

The complete system architecture, with the reasoning behind each decision. This is the synthesis document; where a topic has a dedicated spec ([CONTRACT_SPEC.md](CONTRACT_SPEC.md), [DATABASE.md](DATABASE.md), [API.md](API.md)), that file is authoritative and this one summarizes and connects.

The governing constraint, from which most decisions follow: **Distro moves real money on a schedule, and is explicitly not a custodian.** Every choice below is downstream of "correct and non-custodial beats clever."

---

## 1. System shape

Distro is a **push** distribution engine: the sender pays many recipients in one workflow; recipients never transact. Two execution models, shipped in sequence:

- **Multisend (MVP, built)** — execution happens _now_, while the creator is present and signing. Needs no custody, no backend services.
- **Escrow (later)** — execution happens _on a schedule_, while the creator is offline. Everything heavy (escrow, keeper, indexer, onchain data availability) exists only to serve this.

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Next.js client)                                │
│  wallet connect · CSV import · validation · review       │
└───────────────┬──────────────────────┬──────────────────┘
                │ SIWE + reads/writes   │ signs txs
                ▼                       ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│  Next.js server           │   │  Monad Mainnet           │
│  route handlers (API)     │   │  Multisend (MVP)         │
│  SIWE verify · CSV parse   │   │  Escrow factory (later)  │
└───────────┬───────────────┘   └───────────┬──────────────┘
            │                                │ events
            ▼                                ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│  Neon Postgres            │◀──│  Indexer service (later) │
│  cache/index · server-only │   │  long-running, reorg-safe │
└───────────────────────────┘   └──────────────────────────┘
```

The dashed pieces (indexer, escrow) are **Phase 3+**. The MVP is the top box, the Next.js server, Neon Postgres, and the Multisend contract — nothing else.

**Why sequence it this way.** The MVP's entire value — bulk send, per-recipient tracking, retry — is deliverable with a ~100-line stateless contract and no backend services, because the execution transaction's own receipt already contains every result event. Scheduling is the only requirement that forces escrow/keeper/indexer, and scheduling is an unvalidated hypothesis (the PRD's problem statement never mentions timing). We refuse to pay for it before it's validated. See [CTO_REVIEW.md](CTO_REVIEW.md) S1.

---

## 2. Smart contracts

### MVP: `Multisend` (built)

Stateless. `distribute(token, payload)` pulls from `msg.sender` and pushes to each recipient in one transaction.

| Decision                                                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Direct `msg.sender → recipient` transfers, never pull-then-push**          | If the contract held a pooled total, a failed transfer would strand tokens _in the contract_, forcing a refund path, forcing state. Direct transfer keeps the contract balance permanently zero: a failed payment simply doesn't happen and the tokens stay with the sender. No refund, no state, nothing to steal. Asserted as a fuzz invariant.                                                      |
| **No owner, no pause, no fee hook**                                          | Nothing to govern. A stateless contract is trivially replaceable (redeploy + repoint frontend), so the "install the fee now to avoid re-auditing" logic — which is real for escrow — doesn't apply. An admin key would forfeit the strongest security claim available: _no admin, never holds your money._                                                                                             |
| **Per-recipient failure isolation (try/catch semantics via low-level call)** | One blocklisted address (USDC-class) must not revert an entire payroll. Failures are recorded and emitted; retry is a second call with the failed subset.                                                                                                                                                                                                                                              |
| **Low-level `call` + manual return decode, not try/catch + SafeERC20**       | try/catch needs an _external_ call, which means exposing a self-callable transfer helper — a function that, if its caller-guard were ever wrong, drains every wallet that approved the contract. The low-level call avoids that surface entirely, and correctly handles USDT-class tokens that return nothing (a plain `IERC20` call reverts decoding the empty return, marking every payment failed). |
| **Gas floor per transfer**                                                   | A _correctness_ control here (not security — only the caller's own tokens move). Without it, a low gas limit starves transfers and records healthy recipients as rejections. Value is measured, not guessed — see §11.                                                                                                                                                                                 |
| **`uint128` amount in the payload**                                          | Packs `address + amount` into 36 bytes for cheap calldata. `uint128` caps one payment at ~3.4e38 base units — headroom for high-supply tokens where `uint96` would overflow.                                                                                                                                                                                                                           |

Reentrancy-guarded; rejects zero recipients, ragged payloads, and non-contract token addresses. 31 tests (unit, fuzz, reentrancy proven non-vacuous, gas benchmarks).

### Later: Escrow (`DistributionFactory` + `Distribution`)

Only when scheduling is validated. Full design in [CONTRACT_SPEC.md](CONTRACT_SPEC.md); the load-bearing decisions:

- **Pre-funded escrow + permissionless execution.** A scheduled run must fire while the creator is offline without Distro holding keys. Anyone can trigger execution; funds can only reach the committed recipients. Distro's keeper is a convenience, not a dependency — so payroll can't miss because Distro is down. Chosen over allowance+relayer (which makes Distro's relayer a single point of failure and edges toward custody) and EIP-7702 (account-wide risk, least battle-tested).
- **Recipient list emitted as event data, not stored.** Storing costs ~20k gas/entry; event data ~8 gas/byte. Critically, this is what makes permissionless execution _real_ — a third party can reconstruct the list from logs. Committing only a hash (the first draft) left the list solely in Distro's DB, silently reintroducing the exact liveness dependency escrow exists to remove. See [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) C1.
- **Contract computes `totalAmount` itself** from the committed payloads, rather than trusting a creator-supplied number.
- **Gas floor becomes a security control** here (execution is permissionless, so griefing is a real threat), governed by the invariant _a chunk execution either records true outcomes or reverts entirely._
- **Immutable clones (EIP-1167 + CREATE2).** Per-distribution isolation; deterministic addresses double as the double-funding idempotency guard.

### Cross-cutting contract conventions

- Solidity 0.8.28, Foundry, built on OpenZeppelin (never reimplement primitives).
- One normative payload encoding shared by MVP and escrow, so the escrow reuses audited machinery.
- Never hardcode a Monad address (monskills `addresses`); deploy via Safe multisig, never a bare EOA; verify via the multi-explorer API.

---

## 3. Frontend architecture

**Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + wagmi/viem.** One app in `web/`, three route groups.

| Decision                                                                      | Why                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single Next.js app, route groups for marketing / dashboard**                | Marketing and product share design tokens and the wallet-auth control; splitting them would duplicate both. Route groups (`(marketing)`, `(dashboard)`) separate concerns without separate deploys. A `(claim)` group was scaffolded then deleted — push model has no recipient surface.                            |
| **Server Components by default, client islands for wallet/interaction**       | Wallet state, signing, and live progress are inherently client-side (wagmi hooks); everything else (layout, static content, session-read dashboard shell) renders on the server. The dashboard reads the session server-side and passes the address down, avoiding a client round-trip to show authenticated state. |
| **shadcn/ui (Radix base) over a component framework**                         | Owned, in-repo components we can shape to the Stripe/Linear/Mercury restraint the brand demands, not a themed dependency. The `impeccable` design hook reviews these on edit.                                                                                                                                       |
| **viem's built-in `monad` chain, mainnet-only wagmi config**                  | Chain id 143 and the canonical RPC/explorer set are protocol facts from viem, not hand-rolled config. The config contains a single chain — the app must never connect to any other network.                                                                                                                         |
| **CSV parsing/validation runs client-side for UX, server-side for authority** | Instant feedback on the recipient list without a round-trip; the server re-validates because client validation is never a security boundary.                                                                                                                                                                        |

**Rendering split, concretely:** marketing pages static; dashboard shell server-rendered from the session cookie; the distribution flow (import → validate → review → sign) is a client island because it orchestrates wallet interaction and live transaction state.

---

## 4. Backend architecture

**Next.js route handlers** (`web/src/app/api/`) for the MVP. A separate long-running **indexer service** joins later for escrow.

| Decision                                                                     | Why                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route handlers, not a separate API service, for the MVP**                  | The MVP's server needs are auth verification, CSV validation/storage, and history reads — all request/response. Serverless handlers fit, deploy with the frontend, and add no ops surface.                                                                                                                                      |
| **The indexer is a separate long-running service, and cannot be serverless** | It holds a persistent event subscription with confirmation-depth and reorg handling — the one thing serverless can't do. It gets its own deploy target, monitoring, and restart semantics. It's Phase 3+ because the MVP doesn't need it: the execution receipt carries every `Paid`/`PaymentFailed` event, parsed client-side. |
| **No custom backend for execution**                                          | Distro never executes on the user's behalf in the MVP (they sign) and only _optionally_ keeps for convenience in escrow (permissionless, so anyone can). There is deliberately no "execute for me" endpoint that takes custody.                                                                                                 |
| **Server owns all database access**                                          | Reads, state transitions, and indexer upserts run server-side with `DATABASE_URL`; the browser never receives database credentials.                                                                                                                                                                                             |

---

## 5. Database

**Neon Postgres** as an **index/cache over onchain state — the chain is the source of truth.** Full schema in [DATABASE.md](DATABASE.md).

| Decision                                                                 | Why                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DB is a cache, and losing it must be survivable**                      | Every row is reconstructable from onchain events (this is only _true_ because the escrow emits the recipient payload — see §2). The rebuild-from-chain path is a real requirement, not DR theater: it's the same code path a third-party executor uses, so it stays exercised. |
| **Amounts in base units, `numeric(78,0)`, with cached token `decimals`** | Human-unit vs base-unit ambiguity is the highest-probability money bug. One representation onchain-adjacent; convert for display only. The validator rejects values exceeding the payload's `uint128` cap, since Postgres would happily store what the contract can't accept.  |
| **`chain_id` is first-class, never inferred**                            | Mainnet vs testnet must be an explicit column so a cross-environment mixup is impossible.                                                                                                                                                                                      |
| **`(tx_hash, log_index)` unique on the event log**                       | The indexer's idempotency key. Without it a restart or concurrent run double-counts payments.                                                                                                                                                                                  |
| **Recipient `position` is load-bearing, not cosmetic**                   | The onchain commitment hashes the _ordered_ payload; reconstruction requires exact original ordering. Also the retry key `(chunk_index, position)` — retry is keyed by position, never address, because duplicate addresses are legal.                                         |
| **Soft-delete only; `audit_log` table**                                  | Compliance and dispute resolution for a money product; UI actions must not destroy history.                                                                                                                                                                                    |
| **State enum mirrors the onchain machine exactly**                       | No product-only states. "Scheduled but unfunded" is `ready` + a future `execute_after` derived at read time, not a seventh enum the chain knows nothing about.                                                                                                                 |

---

## 6. Authentication

**SIWE (Sign-In With Ethereum) → stateless JWT session cookie.** Not RainbowKit, not Para.

| Decision                                                    | Why                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SIWE over Para/embedded wallets**                         | Requirements are plain connect/session/protected-route with no email/social/embedded need; the approved architecture specified SIWE; and Para requires external API-key provisioning the user must do. SIWE is self-contained and is the standard for wallet-native products. Para remains a clean drop-in later if embedded wallets are wanted. |
| **Stateless JWT (jose, HS256), not a server session store** | No session table to operate for Feature 1; the signed cookie carries the wallet address, which server routes resolve to an ownership-scoped database user.                                                                                                                                                                                       |
| **Nonce in a short-lived httpOnly cookie**                  | Replay protection without a nonce store: the signed message's nonce must match the cookie the server issued. httpOnly means JS can't exfiltrate it.                                                                                                                                                                                              |
| **Mainnet enforced at verify time**                         | The SIWE message's `chainId` must be 143 (Monad Mainnet) or verification fails — mainnet-only is an auth invariant, not just a UI default.                                                                                                                                                                                                       |
| **jose, imported via narrow JWS subpaths**                  | jose works in the Edge runtime (middleware verifies the session there); the barrel import pulls JWE/deflate code the Edge runtime rejects, so only the JWS sign/verify paths are imported.                                                                                                                                                       |

Route protection is Edge middleware on `/dashboard/*`; the dashboard page _also_ re-verifies server-side (defense in depth) and reads the address from the token directly.

---

## 7. Wallet integration

| Decision                                               | Why                                                                                                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **wagmi v3 + viem, injected connector**                | Covers browser-extension wallets with no external API key. WalletConnect slots in once a project id is provisioned.                                                     |
| **`shimDisconnect` on the injected connector**         | Honors an explicit user disconnect across reloads rather than silently reconnecting.                                                                                    |
| **Auth truth = server session, not wallet connection** | A connected wallet is not an authenticated user. `useAuth` treats "has a valid SIWE session cookie" as authenticated; connection is merely the precondition to sign in. |
| **`useSendTransactionSync` where applicable (later)**  | Monad supports `eth_sendRawTransactionSync` — receipt in the same call, for a faster UI. Applied when the distribution flow is built.                                   |

The sign-in flow: connect → (switch to mainnet if needed) → fetch nonce → build SIWE message → sign → server verifies → session cookie set.

---

## 8. Folder structure

```
distro/
├── contracts/                     # Foundry
│   ├── src/
│   │   ├── Multisend.sol           # MVP (built)
│   │   └── interfaces/
│   ├── test/                        # one file per contract + mocks/, gas benchmarks
│   ├── script/                       # deploy scripts (Safe-based)
│   └── foundry.toml
│
├── web/                            # Next.js 15
│   └── src/
│       ├── app/
│       │   ├── (marketing)/         # landing / sign-in surface
│       │   ├── (dashboard)/          # protected product UI
│       │   ├── api/auth/              # nonce · verify · me · logout
│       │   ├── layout.tsx · providers.tsx · middleware.ts
│       ├── components/
│       │   ├── auth/ · layout/ · ui/  # ui/ = shadcn primitives
│       ├── lib/
│       │   ├── auth/                   # session · siwe · api · constants
│       │   ├── wagmi/ · db/             # config + Neon queries
│       │   └── format.ts
│       └── config/chains.ts            # Monad mainnet
│
├── database/                       # Postgres migrations/
├── docs/                            # specs (PRD, CONTRACT_SPEC, DATABASE, API, …)
├── PRODUCT.md · DESIGN.md          # impeccable design context
└── CLAUDE.md · README.md
```

**Why this shape:** monorepo per the monskills scaffold convention (`contracts/` + `web/`), so a single checkout builds everything. `lib/` splits by concern (auth, wagmi, database) rather than by type, so a feature's server + client pieces live together. The indexer, when built, becomes a sibling top-level service (`indexer/`), never a route handler.

---

## 9. State management

No global state library. State is placed by its nature and lifetime:

| State                                | Home                            | Why                                                                                               |
| ------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Wallet connection / chain            | wagmi hooks                     | wagmi owns it; wrapping it would just add a layer.                                                |
| Server session (auth truth)          | react-query over `/api/auth/me` | Shared, cacheable, invalidated on sign-in/out. One source across components.                      |
| Onchain reads                        | react-query + viem              | Same cache/invalidation model; keys by query.                                                     |
| Server data (distributions, history) | react-query over route handlers | Same. An indexer-driven sync path replaces polling once escrow lands.                             |
| Form / import state                  | local component state           | Ephemeral, single-surface; no reason to hoist it.                                                 |
| Auth-derived UI                      | `useAuth` hook                  | One hook composes wagmi + the session query into `{ address, isAuthenticated, signIn, signOut }`. |

**Why no Redux/Zustand:** the app has no genuinely global mutable client state. Wallet state belongs to wagmi, server state to react-query; a store would duplicate both and invite drift between them. This is the standard modern web3 stack precisely because those two libraries already cover the field.

---

## 10. API design

Route handlers under `web/src/app/api/`. Full surface in [API.md](API.md); principles:

- **Auth (built):** `GET /nonce`, `POST /verify`, `GET /me` (status probe, never 401s), `POST /logout` (idempotent).
- **Every onchain-derived response carries `lastIndexedBlock`** so the UI can render an explicit "syncing" state during indexer lag — otherwise users read lag as failure and retry, wasting gas.
- **Write endpoints are idempotent** — resubmitting a confirmed tx hash never duplicates records.
- **Server-side validation is authoritative**; client validation is UX. CSV parsing defends against formula injection and unbounded size.
- **Rate-limit** the expensive endpoints (upload, chunk computation).
- **No custody endpoint.** Nothing on the server moves funds; the server records and reports, the user (or a permissionless executor) transacts.

---

## 11. Security model

**Layered, with the contract as the last line and no admin backdoor.**

| Layer          | Control                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contract**   | No custody (MVP balance always zero); no admin key; SafeERC20 semantics via guarded low-level calls; reentrancy guards; excludes ERC-777/callback and fee-on-transfer/rebasing tokens; gas floor prevents false-failure recording. Escrow adds: permissionless execution can never redirect funds, factory pause can't touch funded distributions, fuzz+invariant suite, external audit before mainnet. |
| **Session**    | SIWE with domain binding, server-issued nonce, replay protection, mainnet-bound `chainId`; httpOnly cookies; Edge-verified route protection + server-side re-verification.                                                                                                                                                                                                                              |
| **Database**   | Neon is server-only. Every route derives the owner from the verified SIWE session and scopes SQL by `user_id`; `DATABASE_URL` never reaches browser code. Cross-tenant route tests verify that foreign ids return 404.                                                                                                                                                                                  |
| **Ingestion**  | CSV upload guarded against formula injection, oversize, malformed encoding; server-authoritative validation; rate limiting.                                                                                                                                                                                                                                                                             |
| **Operations** | Safe multisig on any privileged contract role from day one (testnet included); the keeper (escrow) signs _executions_ only, never transfers of custody; a per-distribution size cap during the first mainnet weeks to bound blast radius.                                                                                                                                                               |

**Two invariants stated as promises:**

1. Distro never holds user keys, and holds funds only inside a distribution's own escrow (never in the MVP).
2. No admin path can move a user's funds — provable in tests, not just review.

**`MIN_GAS_PER_TRANSFER` is an open security-adjacent item.** The current value is a conservative placeholder; the real figure must be _measured_ on Monad (the "×4 for cold access" extrapolation is invalid — that penalty doesn't apply to the SSTORE that dominates a transfer). A guessed value is either decorative or actively harmful. Blocks mainnet.

---

## 12. Scalability strategy

The bottleneck is never Monad's throughput — it's the indexer and RPC limits.

| Concern                  | Strategy                                                                                                                                                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contract execution**   | Chunked; ceiling is the caller's gas budget, not the design. Fine for the corrected target scale (payroll/grants/community, hundreds to low thousands — not mass airdrops, where push is the wrong economics; see [CTO_REVIEW.md](CTO_REVIEW.md) P2). |
| **Indexer (escrow era)** | The real scaling risk: a 5,000-recipient run emits 5,000 events in a short window. Bulk-insert (not row-at-a-time), back-pressure the Realtime fan-out, write only past confirmation depth, reconcile against onchain reads periodically.             |
| **Dashboard**            | Server-side pagination/filter/sort from day one; the DB indexes in [DATABASE.md](DATABASE.md) exist for exactly these query patterns.                                                                                                                 |
| **RPC**                  | Rate limits appear before throughput does — choose a provider from the monskills `tooling-and-infra` list before load, not after; plan failover.                                                                                                      |
| **Read scale**           | Indexer-driven refresh replaces receipt polling; react-query caches onchain reads; `lastIndexedBlock` lets the client reason about freshness without hammering.                                                                                       |

**Deliberate anti-scaling choice for the MVP:** no indexer at all. The execution receipt is the source of results, parsed client-side. This removes the single most operationally demanding component from the critical path until scheduling forces it — which is the whole reason the MVP can ship without a standing backend.

---

## Decisions still open (they shape architecture, so they're tracked here)

From [ROADMAP.md](ROADMAP.md) and [CONTRACT_SPEC.md](CONTRACT_SPEC.md):

- **Measure `MIN_GAS_PER_TRANSFER` on Monad** — blocks MVP mainnet.
- **O1 — irrevocable mode?** Cancel-any-time makes "scheduled" a promise, not a guarantee (fine for payroll, wrong for grants/bounties). Can't retrofit into an immutable clone.
- **O2 — execution incentive?** Permissionless execution is only real if a non-Distro party is motivated to run it; otherwise the honest claim is "the creator self-serves."
- **O3 — recurring shape** — one contract with N tranches vs. N distributions from a template; changes whether v1 escrow needs cycle state.
- **Monetization basis** — per-recipient vs per-distribution vs volume changes where the fee hook lives; decide before escrow.
- **Airdrop scope, team accounts, compliance screening** — product decisions with schema/contract consequences.
