# Database — DISTRO

Postgres. Off-chain data is an index/cache over on-chain state for fast dashboard queries — the chain remains the source of truth; this schema should always be reconstructable from on-chain events plus creator-supplied metadata (CSV uploads).

## Tables

### `campaigns`

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `contract_address` | text, unique | on-chain campaign contract |
| `campaign_type` | enum(`airdrop`, `vesting`, `batch_payout`) | |
| `creator_address` | text | |
| `token_address` | text | ERC-20 being distributed |
| `merkle_root` | text, nullable | airdrop only |
| `claim_deadline` | timestamptz, nullable | airdrop only |
| `cliff_default_seconds` | bigint, nullable | vesting only |
| `duration_default_seconds` | bigint, nullable | vesting only |
| `status` | enum(`draft`, `deployed`, `funded`, `active`, `completed`) | |
| `created_at` | timestamptz | |
| `deployed_at` | timestamptz, nullable | |

### `recipients`

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `campaign_id` | uuid, FK → campaigns | |
| `address` | text | |
| `amount` | numeric | in token base units |
| `cliff_seconds` | bigint, nullable | vesting override |
| `duration_seconds` | bigint, nullable | vesting override |
| `merkle_proof` | jsonb, nullable | airdrop only, cached proof |
| `status` | enum(`pending`, `claimed`, `partially_released`, `fully_released`, `sent`, `failed`) | meaning depends on `campaign_type` |
| `released_amount` | numeric, default 0 | vesting only, running total |
| `claimed_at` | timestamptz, nullable | |

Unique constraint on `(campaign_id, address)`.

### `claim_events`

Append-only log of on-chain claim/release/payout transactions, populated by the indexer — used to reconcile `recipients.status` and for audit trail.

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `campaign_id` | uuid, FK → campaigns | |
| `recipient_address` | text | |
| `event_type` | enum(`claim`, `release`, `payout`, `recovery`) | |
| `amount` | numeric | |
| `tx_hash` | text | |
| `block_number` | bigint | |
| `occurred_at` | timestamptz | |

### `users` (creators)

| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `wallet_address` | text, unique | primary identity, no separate auth account in v1 (wallet-signature login) |
| `created_at` | timestamptz | |

## Indexing notes

- The indexer listens for `CampaignCreated` from `DistroFactory` and per-event logs (`Claimed`, `Released`, `PaidOut`, `Recovered`) from campaign contracts, writing into `claim_events` and updating `recipients.status` / `campaigns.status` accordingly.
- Reconciliation job should periodically re-verify indexed state against on-chain reads to catch missed events (RPC gaps, reorgs) — flag drift rather than silently trusting the index.
