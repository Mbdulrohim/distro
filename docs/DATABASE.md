# Database — Distro

Supabase (Postgres). Offchain data is an **index/cache over onchain state for fast dashboard queries — the chain is the source of truth.** Every table here is reconstructable from onchain events plus the creator's original CSV; losing the database must be survivable, not catastrophic.

The schema comes in **two tiers**, matching the build sequence:

- **Tier 1 — MVP (build now).** Backs the `Multisend` flow. No indexer, no escrow, no chunks. The dashboard writes results parsed from the execution receipt.
- **Tier 2 — escrow era (later).** Adds what scheduling needs: per-distribution escrow state, onchain-commitment mirroring, and an indexer-written event log.

> Supersedes the pre-definition draft (Merkle roots, proofs, claim status) — Distro has no claim step.

## Supabase-specific ground rules (both tiers)

- **RLS is the entire access-control story.** Identity is the wallet address from the SIWE JWT. Policies scope creators to their own rows. Assume nothing from project defaults.
- **The service-role key never reaches the client.** Privileged writes go through server route handlers (Tier 1) or the indexer service (Tier 2).
- **Storage** keeps the original uploaded CSV for audit/dispute resolution, not just the parsed rows.
- **Soft-delete only.** Audit trails must not be destructible from the UI.
- **Realtime** replaces polling for live status (matters most in Tier 2).

---

# Tier 1 — MVP schema

Three tables. The `Multisend` flow is: create a distribution → import recipients → approve → call `distribute` (one or more transactions if the list exceeds one block's gas) → parse the receipt → write results. No scheduling, no escrow, no indexer.

## `users`

Why it exists: to anchor a wallet identity that distributions belong to, and to give RLS a subject. There is no separate auth account — the wallet _is_ the account (SIWE).

| column           | type        | constraints / notes                                                      |
| ---------------- | ----------- | ------------------------------------------------------------------------ |
| `id`             | uuid        | PK                                                                       |
| `wallet_address` | citext      | **unique**. `citext` so address casing can't create duplicate identities |
| `created_at`     | timestamptz | default now                                                              |

> A wallet may read/update only its own row (RLS). Team/org accounts are a known future gap — they'd insert an `organizations` / `team_members` layer between `users` and `distributions`, which is why distributions key on a user, not just a raw address.

## `distributions`

Why it exists: one row per logical send the creator defines — the unit the dashboard lists, the thing a recipient list and a result set hang off. In the MVP a distribution is **not** its own contract (all runs share the single deployed `Multisend`), so there is no per-distribution address, no `salt`, and no escrow state machine here — those are Tier 2 concepts.

| column                          | type          | constraints / notes                                                                      |
| ------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `id`                            | uuid          | PK                                                                                       |
| `user_id`                       | uuid          | **FK → users(id)**, `on delete restrict` (never orphan a money record)                   |
| `chain_id`                      | integer       | **first-class**, never inferred. Monad Mainnet = 143                                     |
| `multisend_address`             | citext        | which deployed `Multisend` executed this — provenance if the contract is ever redeployed |
| `name`                          | text          | creator-supplied label                                                                   |
| `token_address`                 | citext        | ERC-20 being distributed                                                                 |
| `token_symbol`                  | text          | cached for display                                                                       |
| `token_decimals`                | smallint      | cached — required to convert base units for display; `check 0..36`                       |
| `total_amount`                  | numeric(78,0) | **base units**, sum of recipient amounts                                                 |
| `recipient_count`               | integer       | denormalized count; `check > 0`                                                          |
| `status`                        | enum          | `draft`, `submitted`, `partially_completed`, `completed`, `failed`                       |
| `csv_storage_path`              | text          | nullable — original upload in Supabase Storage                                           |
| `created_at`                    | timestamptz   | default now                                                                              |
| `submitted_at` / `completed_at` | timestamptz   | nullable                                                                                 |
| `deleted_at`                    | timestamptz   | nullable — soft-delete (drafts only; a submitted distribution is history)                |

Status meaning: `draft` (defined, not yet signed) → `submitted` (≥1 transaction sent) → `completed` (all transactions mined, all recipients resolved) or `partially_completed` (some recipients failed and can be retried) or `failed` (every transaction reverted).

## `distribution_transactions`

Why it exists: a distribution that exceeds one block's gas is sent as **several `distribute` calls**. Each is a real onchain transaction with its own hash, status, and slice of recipients. This table is what lets the dashboard show progress ("2 of 3 batches mined") and map a `Paid` event back to the recipient that produced it — the event's `index` is the recipient's position _within that transaction's payload_, so the mapping needs the transaction, not just the distribution.

| column                      | type        | constraints / notes                                   |
| --------------------------- | ----------- | ----------------------------------------------------- |
| `id`                        | uuid        | PK                                                    |
| `distribution_id`           | uuid        | **FK → distributions(id)**, `on delete cascade`       |
| `batch_index`               | integer     | 0-based order within the distribution                 |
| `tx_hash`                   | citext      | nullable until submitted                              |
| `status`                    | enum        | `pending`, `mined`, `reverted`                        |
| `block_number`              | bigint      | nullable                                              |
| `gas_used`                  | bigint      | nullable — real gas, for the "measure the floor" work |
| `submitted_at` / `mined_at` | timestamptz | nullable                                              |

Unique on `(distribution_id, batch_index)`.

## `recipients` (MVP form)

Why it exists: the payout ledger — who is owed what, in which transaction they were paid, and whether it landed. This is the queryable projection of the CSV plus the receipt results.

| column            | type          | constraints / notes                                                             |
| ----------------- | ------------- | ------------------------------------------------------------------------------- |
| `id`              | uuid          | PK                                                                              |
| `distribution_id` | uuid          | **FK → distributions(id)**, `on delete cascade`                                 |
| `transaction_id`  | uuid          | **FK → distribution_transactions(id)**, nullable until assigned to a batch      |
| `batch_index`     | integer       | which transaction pays this recipient                                           |
| `index_in_batch`  | integer       | **ordinal within the batch payload — load-bearing** (maps to the event `index`) |
| `address`         | citext        | recipient                                                                       |
| `amount`          | numeric(78,0) | base units; `check amount > 0` and `check amount <= 2^128 - 1`                  |
| `status`          | enum          | `pending`, `paid`, `failed`                                                     |
| `failure_reason`  | text          | nullable — revert reason where recoverable                                      |
| `paid_at`         | timestamptz   | nullable                                                                        |

Unique on `(distribution_id, batch_index, index_in_batch)`.

**Constraints that carry weight:**

- **`amount <= 2^128 - 1`** — the payload encoding caps a payment at `uint128`. `numeric(78,0)` would happily store a value the contract cannot accept; the check rejects it at write time rather than at execution, after the user has committed.
- **Not unique on `(distribution_id, address)`** — a creator may intentionally pay one address twice. Duplicates are flagged during validation, never forbidden.
- **`index_in_batch` ordering is load-bearing**, even in the MVP: it's how a `Paid`/`PaymentFailed` event (which carries only an index) is mapped back to a row. Never reorder it.

---

# Tier 2 — escrow-era additions

Added when scheduling ships. `Multisend` records still use the Tier 1 shape; escrow distributions extend it. Full contract behavior in [CONTRACT_SPEC.md](CONTRACT_SPEC.md).

## `distributions` — additional columns

An escrow distribution _is_ its own contract and runs a state machine, so it needs fields the MVP doesn't:

| column                                  | type                     | why                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract_address`                      | citext, unique, nullable | the per-distribution clone; known _before_ deployment (CREATE2 is deterministic)                                                                                                                        |
| `salt`                                  | text                     | idempotency key; **unique with `user_id`**, mirroring the factory's CREATE2 guard. Stops a double-click from deploying two escrows and paying everyone twice — and in a push model there is no clawback |
| `chunk_count` / `committed_chunk_count` | integer                  | commits span multiple transactions for large lists                                                                                                                                                      |
| `execute_after`                         | timestamptz              | the schedule; enforced onchain, mirrored here                                                                                                                                                           |
| `irrevocable`                           | boolean                  | only if decision O1 lands ([CONTRACT_SPEC.md](CONTRACT_SPEC.md))                                                                                                                                        |
| `reclaimed`                             | boolean                  | mirrors the onchain flag; blocks execution                                                                                                                                                              |

The escrow `status` enum widens to the onchain machine: `draft`, `ready`, `funded`, `executing`, `completed`, `cancelled`. It mirrors the chain **exactly** — never a product-only state. "Scheduled but unfunded" is `ready` + a future `execute_after`, derived at read time, not a stored enum value the chain knows nothing about.

## `distribution_chunks`

Why it exists: escrow commits the recipient list onchain in chunks, each identified by a hash. This table mirrors those commitments so the dashboard (and a rebuild-from-chain job) can reconstruct exactly what was committed.

| column                                   | type        | constraints / notes                                              |
| ---------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `id`                                     | uuid        | PK                                                               |
| `distribution_id`                        | uuid        | **FK → distributions(id)**                                       |
| `chunk_index`                            | integer     |                                                                  |
| `chunk_hash`                             | text        | `keccak256(abi.encode(contract, chunkIndex, payload))`           |
| `payload`                                | bytea       | the canonical committed bytes, cached from `RecipientsCommitted` |
| `committed_tx_hash` / `executed_tx_hash` | citext      | nullable                                                         |
| `executed`                               | boolean     | default false                                                    |
| `executed_at`                            | timestamptz | nullable                                                         |

Unique on `(distribution_id, chunk_index)`.

> `payload` is stored **verbatim**, not re-derived from `recipients` rows at execution time. Re-deriving risks an encoding drift that produces a hash mismatch and an unexecutable distribution — keeping the exact committed bytes makes execution a lookup, not a reconstruction. The `recipients` rows stay the queryable projection of the same data.

## `payment_events`

Why it exists: in Tier 2 the creator is offline during execution, so results can't come from a receipt they're holding — an indexer watches the chain and writes here. This append-only log is what reconciles `recipients.status` and `distributions.status`, and it is the audit trail.

| column              | type          | constraints / notes                                                                       |
| ------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| `id`                | uuid          | PK                                                                                        |
| `distribution_id`   | uuid          | **FK → distributions(id)**                                                                |
| `event_type`        | enum          | `created`, `funded`, `chunk_executed`, `paid`, `payment_failed`, `cancelled`, `reclaimed` |
| `recipient_address` | citext        | nullable                                                                                  |
| `amount`            | numeric(78,0) | nullable                                                                                  |
| `tx_hash`           | citext        |                                                                                           |
| `log_index`         | integer       |                                                                                           |
| `block_number`      | bigint        |                                                                                           |
| `occurred_at`       | timestamptz   |                                                                                           |

**Unique on `(tx_hash, log_index)`** — the indexer's idempotency key. Without it, an indexer restart or a concurrent run double-counts payments. This one constraint is the difference between a trustworthy ledger and a corrupt one.

## `audit_log`

Why it exists: creator/admin actions (created, funded, cancelled, retried, reclaimed) for support and dispute resolution — expected for infrastructure moving real money, and not something the event log alone captures (it records off-chain intent too).

| column            | type                               | notes |
| ----------------- | ---------------------------------- | ----- |
| `id`              | uuid, PK                           |       |
| `user_id`         | uuid, FK → users                   |       |
| `distribution_id` | uuid, FK → distributions, nullable |       |
| `action`          | text                               |       |
| `metadata`        | jsonb                              |       |
| `created_at`      | timestamptz                        |       |

---

# Relationships (whole schema)

```
users ──1:N──▶ distributions ──1:N──▶ distribution_transactions   (Tier 1)
                    │        └─1:N──▶ recipients ──N:1──▶ distribution_transactions
                    │
                    ├─1:N──▶ distribution_chunks                   (Tier 2)
                    ├─1:N──▶ payment_events                         (Tier 2)
                    └─1:N──▶ audit_log                              (Tier 2)
```

- A **recipient** belongs to one distribution and (once assigned) one transaction/chunk. `recipients.transaction_id` is nullable because rows exist from import, before any batch is sent.
- **Cascade** deletes from distribution → transactions/recipients/chunks (they're meaningless without the parent); **restrict** delete from user → distributions (never orphan a money record — soft-delete instead).
- FKs to `users` are by `id`, not raw address, so a future team/org layer slots in without rewriting every child table.

# Indexes

Distributions run to thousands of recipients; the dashboard's query patterns need explicit support:

| Index                                                       | Tier | Serves                                                       |
| ----------------------------------------------------------- | ---- | ------------------------------------------------------------ |
| `distributions (user_id, created_at desc)`                  | 1    | the creator's distribution list (the dashboard's home query) |
| `distributions (status)`                                    | 1    | filtering active vs. done                                    |
| `distributions (state, execute_after)`                      | 2    | the keeper's "what's due now?" scan                          |
| `distribution_transactions (distribution_id, batch_index)`  | 1    | progress view; also the unique constraint                    |
| `distribution_transactions (tx_hash)`                       | 1    | receipt-driven status updates                                |
| `recipients (distribution_id, status)`                      | 1    | default recipient table + "show failures only"               |
| `recipients (distribution_id, batch_index, index_in_batch)` | 1    | event→row mapping; also the unique constraint                |
| `recipients (address)`                                      | 1    | cross-distribution lookup ("was this address ever paid?")    |
| `distribution_chunks (distribution_id, chunk_index)`        | 2    | reconstruction; also the unique constraint                   |
| `payment_events (distribution_id, occurred_at desc)`        | 2    | audit timeline                                               |
| `payment_events (tx_hash, log_index)` unique                | 2    | indexer idempotency                                          |

# Constraints, in one place

- `users.wallet_address` unique (via `citext`).
- `distributions (user_id, salt)` unique — Tier 2 double-funding guard.
- `distribution_transactions (distribution_id, batch_index)` unique.
- `recipients (distribution_id, batch_index, index_in_batch)` unique — **not** `(distribution_id, address)`.
- `recipients.amount` between 1 and 2^128−1 — enforces the payload's `uint128` cap at write time.
- `distributions.token_decimals` between 0 and 36.
- `distributions.recipient_count` > 0.
- FK delete rules: cascade from distribution to its children; restrict from user to distributions.
- All monetary columns `numeric(78,0)` in **base units** — human units never touch the database.

# Row-level security

Asserting "RLS is the whole story" isn't implementing it. Policies ship **with the first migration**, not after:

- Identity is `auth.jwt() ->> 'address'`, compared against `citext` columns so casing can't silently miss.
- `distributions`: a user may `select`/`update` only rows they own (`user_id` resolves to the JWT address). No blanket public read — v1 has no public distribution pages.
- `distribution_transactions`, `recipients`, `distribution_chunks`, `payment_events`, `audit_log`: reachable only through their parent distribution's ownership check.
- **State-transitioning writes belong to the server / indexer**, not the browser. The anon client holds no `insert`/`update` grant on `payment_events` or transaction status at all.
- Ship **cross-tenant attack tests** with the policies — a policy nobody tried to break is a policy nobody has tested.

# Rebuild-from-chain (both tiers)

Because the chain is the source of truth, a rebuild path is a requirement, not DR theater — in Tier 2 it's the _same_ code path a third-party executor uses, so it stays exercised. Tier 1 rebuilds from `Multisend` receipts; Tier 2 rebuilds from `RecipientsCommitted` + `Paid`/`PaymentFailed` logs, writing only past a confirmation depth to stay reorg-safe, with a reconciliation job that flags drift rather than trusting the index.
