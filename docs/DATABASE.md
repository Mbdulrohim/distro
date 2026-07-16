# Database — Distro

Supabase (Postgres). Offchain data is an **index/cache** over onchain state for fast dashboard queries — **the chain is the source of truth**.

> Supersedes the pre-definition draft (Merkle roots, proofs, claim status) — Distro has no claim step.

**This claim is only true as of CONTRACT_SPEC v2.** The v1 draft committed only chunk *hashes* onchain, which left the recipient list existing nowhere but this database — making it unique, unrecoverable data and the whole "chain is the source of truth" framing a fiction. With `RecipientsCommitted(chunkIndex, payload)` emitted at commit time ([CONTRACT_SPEC.md](CONTRACT_SPEC.md)), every row below is genuinely reconstructable from logs.

Practical consequence: **losing this database must be survivable.** A rebuild-from-chain path is a real requirement, not a disaster-recovery nicety — it's the same code path a third-party executor would use, so it stays exercised rather than rotting.

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
| `contract_address` | text, unique, nullable | known *before* deployment — CREATE2 is deterministic |
| `salt` | text | idempotency key; unique with `creator_address`. See below |
| `chain_id` | integer | **first-class**, never inferred. Monad Mainnet = 143 |
| `creator_address` | text | |
| `name` | text | creator-supplied label |
| `token_address` | text | ERC-20 being distributed |
| `token_symbol` | text | cached for display |
| `token_decimals` | smallint | cached — required to convert base units for display |
| `total_amount` | numeric(78,0) | **base units**. Authoritative value is computed onchain at commit; this mirrors it |
| `recipient_count` | integer | |
| `chunk_count` | integer | |
| `committed_chunk_count` | integer | commits are multi-tx for large lists |
| `execute_after` | timestamptz | the schedule; enforced onchain, mirrored here |
| `irrevocable` | boolean | pending decision **O1** in [CONTRACT_SPEC.md](CONTRACT_SPEC.md) — include only if O1 lands |
| `state` | enum | `draft`, `ready`, `funded`, `executing`, `completed`, `cancelled` |
| `reclaimed` | boolean, default false | mirrors the onchain flag; blocks execution |
| `csv_storage_path` | text, nullable | original upload in Supabase Storage |
| `created_tx_hash` / `funded_tx_hash` | text, nullable | |
| `created_at` / `funded_at` / `completed_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft-delete |

Unique on `(creator_address, salt)`, mirroring the factory's CREATE2 guard.

> **`salt` is a money-safety field, not bookkeeping.** It's what stops a double-click, an RPC retry, or an impatient user from creating two escrows and paying everyone twice — and in a push model there is no clawback. Monad's ~400ms blocks make the UI feel slow relative to block time, which makes re-clicking *more* likely, not less. The DB constraint is defense in depth; the factory's `(creator, salt)` revert is the real guard.
>
> `state` mirrors the onchain state machine exactly ([CONTRACT_SPEC.md](CONTRACT_SPEC.md)). Never let it drift into product-only states — if the dashboard needs "scheduled but unfunded", that's `ready` with `execute_after` in the future, derived at read time, not a seventh enum value that the chain knows nothing about.

### `distribution_chunks`

Mirrors the onchain chunk commitments.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `distribution_id` | uuid, FK → distributions | |
| `chunk_index` | integer | |
| `chunk_hash` | text | `keccak256(abi.encode(address(distribution), chunkIndex, payload))` |
| `payload` | bytea | the canonical bytes — cached from `RecipientsCommitted`, recoverable from logs |
| `committed_tx_hash` | text, nullable | |
| `executed` | boolean, default false | |
| `executed_tx_hash` | text, nullable | |
| `executed_at` | timestamptz, nullable | |

Unique on `(distribution_id, chunk_index)`.

`payload` is stored verbatim rather than re-derived from `recipients` rows at execution time. Re-deriving invites an encoding drift that produces a hash mismatch and an unexecutable distribution; keeping the exact committed bytes makes the executor's job a lookup, not a reconstruction. The `recipients` rows remain the queryable projection of the same data.

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

> **`position` is not cosmetic.** The onchain commitment hashes the *ordered* payload. Reproducing a chunk that hashes to `chunk_hash` requires the exact original ordering — never `ORDER BY` anything else when reconstructing. `position` is also the retry key: [CONTRACT_SPEC.md](CONTRACT_SPEC.md) keys `retry` by `(chunkIndex, position)` rather than by address, precisely because duplicate addresses are legal.
>
> Since v2 emits the payload onchain, a lost ordering is recoverable from logs rather than fatal — but the cached ordering must still match, or every chunk the dashboard builds will be rejected.
>
> Deliberately **not** unique on `(distribution_id, address)` — a creator may intentionally pay the same address twice (flagged during validation, not forbidden).
>
> `amount` is capped at `uint128` by the canonical payload encoding (~3.4e38 base units). The upload validator must enforce this at import; `numeric(78,0)` will happily hold a value the contract cannot.

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

## Indexes

Distributions run to thousands of recipients; the dashboard's query patterns need explicit support rather than whatever the FK constraints happen to give:

| Index | Serves |
|---|---|
| `recipients (distribution_id, status)` | the default recipient table view + "show failures only" |
| `recipients (distribution_id, chunk_index, position)` | chunk reconstruction (also the unique constraint) |
| `recipients (address)` | cross-distribution lookup ("was this address ever paid?") |
| `distributions (creator_address, created_at desc)` | the creator's distribution list |
| `distributions (state, execute_after)` | the keeper's "what's due?" scan |
| `payment_events (distribution_id, occurred_at desc)` | audit timeline |
| `payment_events (tx_hash, log_index)` unique | indexer idempotency (below) |

## Row-level security

"RLS is the entire access-control story" is asserted above; asserting it is not implementing it. Policies are written **before** the first table ships, not retrofitted:

- Identity is the wallet address from the SIWE JWT (`auth.jwt() ->> 'address'`), lowercased for comparison — address casing is a real source of silent policy misses.
- `distributions`: creator may `select`/`update` only rows where `creator_address = <jwt address>`. No blanket public read — v1 has no public distribution pages.
- `recipients`, `distribution_chunks`, `payment_events`: readable only via their parent distribution's ownership check.
- **All writes that transition state belong to the server/indexer**, not the browser. The anon client should hold no `insert`/`update` grant on `payment_events` at all.
- `users`: a wallet may read/update only its own row.
- Verify policies with tests that attempt cross-tenant access — a policy nobody tried to break is a policy nobody has tested.

## Indexing notes

- The indexer watches `DistributionCreated` from `DistributionFactory` and per-distribution events (`Paid`, `PaymentFailed`, `ChunkExecuted`, `Cancelled`, `Reclaimed`).
- **Write only past a confirmation depth** to stay reorg-safe; never trust a single fresh log.
- A **reconciliation job** periodically re-verifies indexed state against direct onchain reads and *flags drift* rather than silently trusting the index.
- The indexer is a long-running service — it cannot be a serverless function (see [CTO_REVIEW.md](CTO_REVIEW.md)).
