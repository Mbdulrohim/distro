# Database — Distro

Supabase (Postgres). Offchain data is an **index/cache** over onchain state for fast dashboard queries — **the chain is the source of truth**. This schema must always be reconstructable from onchain events plus creator-supplied metadata (the original CSV).

> Supersedes the pre-definition draft (Merkle roots, proofs, claim status) — Distro has no claim step.

## Design notes specific to Supabase

- **RLS is the entire access-control story.** Wallet-address identity (SIWE → JWT). Policies must scope creators to their own distributions. Assume nothing from Supabase project defaults.
- **Never expose the service-role key client-side.** Privileged writes (state transitions, indexer upserts) go through server routes / the indexer service.
- **Realtime** drives live tracking — subscribe, don't poll.
- **Storage** keeps the original uploaded CSV for audit/dispute resolution, not just the parsed rows.
- **Soft-delete only.** Compliance and audit trails must not be destructible from the UI.

## Tables

### `users`

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `wallet_address` | text, unique | primary identity (SIWE), no separate auth account in v1 |
| `created_at` | timestamptz | |

> Team/org accounts are a known gap — see [CTO_REVIEW.md](CTO_REVIEW.md). Adding them later means an `organizations` / `team_members` layer between `users` and `distributions`.

### `distributions`

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `contract_address` | text, unique, nullable | null until the escrow clone is deployed |
| `chain_id` | integer | **first-class**, never inferred. Monad Mainnet = 143 |
| `creator_address` | text | |
| `name` | text | creator-supplied label |
| `token_address` | text | ERC-20 being distributed |
| `token_symbol` | text | cached for display |
| `token_decimals` | smallint | cached — required to convert base units for display |
| `total_amount` | numeric(78,0) | **base units**, never human units |
| `recipient_count` | integer | |
| `chunk_count` | integer | |
| `execute_after` | timestamptz | the schedule; enforced onchain, mirrored here |
| `state` | enum | `draft`, `created`, `funded`, `scheduled`, `executing`, `completed`, `cancelled` |
| `csv_storage_path` | text, nullable | original upload in Supabase Storage |
| `created_tx_hash` | text, nullable | |
| `funded_tx_hash` | text, nullable | |
| `created_at` / `funded_at` / `completed_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft-delete |

### `distribution_chunks`

Mirrors the onchain chunk commitments.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `distribution_id` | uuid, FK → distributions | |
| `chunk_index` | integer | |
| `chunk_hash` | text | `keccak256(abi.encode(recipients, amounts))` |
| `executed` | boolean, default false | |
| `executed_tx_hash` | text, nullable | |
| `executed_at` | timestamptz, nullable | |

Unique on `(distribution_id, chunk_index)`.

### `recipients`

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `distribution_id` | uuid, FK → distributions | |
| `chunk_index` | integer | which chunk pays this recipient |
| `position` | integer | **ordinal within the chunk — load-bearing** |
| `address` | text | |
| `amount` | numeric(78,0) | base units |
| `status` | enum | `pending`, `paid`, `failed` |
| `failure_reason` | text, nullable | revert reason where available |
| `paid_tx_hash` | text, nullable | |
| `paid_at` | timestamptz, nullable | |

Unique on `(distribution_id, chunk_index, position)`.

> **`position` is not cosmetic.** The onchain commitment is a hash over the *ordered* `recipients[]`/`amounts[]` arrays. If the DB loses the original ordering, the executor cannot reproduce a chunk that hashes to `chunk_hash`, and the distribution becomes unexecutable. Never `ORDER BY` anything else when reconstructing a chunk.
>
> Deliberately **not** unique on `(distribution_id, address)` — a creator may intentionally pay the same address twice (flagged during validation, not forbidden).

### `payment_events`

Append-only log written by the indexer. Reconciles `recipients.status` / `distributions.state` and provides the audit trail.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `distribution_id` | uuid, FK → distributions | |
| `event_type` | enum | `created`, `funded`, `chunk_executed`, `paid`, `payment_failed`, `cancelled`, `reclaimed` |
| `recipient_address` | text, nullable | |
| `amount` | numeric(78,0), nullable | |
| `tx_hash` | text | |
| `log_index` | integer | |
| `block_number` | bigint | |
| `occurred_at` | timestamptz | |

**Unique on `(tx_hash, log_index)`** — this is the indexer's idempotency key. Without it, an indexer restart or a concurrent run double-counts payments.

### `audit_log`

Creator/admin actions (created, funded, cancelled, retried, reclaimed) for support and dispute resolution. Expected for an infrastructure product handling real money.

## Indexing notes

- The indexer watches `DistributionCreated` from `DistributionFactory` and per-distribution events (`Paid`, `PaymentFailed`, `ChunkExecuted`, `Cancelled`, `Reclaimed`).
- **Write only past a confirmation depth** to stay reorg-safe; never trust a single fresh log.
- A **reconciliation job** periodically re-verifies indexed state against direct onchain reads and *flags drift* rather than silently trusting the index.
- The indexer is a long-running service — it cannot be a serverless function (see [CTO_REVIEW.md](CTO_REVIEW.md)).
