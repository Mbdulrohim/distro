# API — DISTRO

Backend REST API backing the dashboard and claim portal. Auth is wallet-signature based (SIWE-style) unless noted.

## Campaigns

- `POST /campaigns` — create a draft campaign (metadata only, pre-deploy). Body: `campaignType`, `tokenAddress`, recipient list (or a reference to an uploaded CSV).
- `GET /campaigns/:id` — campaign details, status, aggregate stats (total recipients, total distributed, total remaining).
- `GET /campaigns?creator=:address` — list campaigns by creator.
- `POST /campaigns/:id/deploy` — record on-chain deployment tx hash/address once the creator's wallet transaction confirms (dashboard calls this after the deploy tx is mined).
- `POST /campaigns/:id/merkle-tree` — (airdrop) generate Merkle tree from the uploaded recipient list, returns root + per-recipient proofs for review before deploy.

## Recipients

- `GET /campaigns/:id/recipients` — paginated recipient list with status.
- `GET /campaigns/:id/recipients/:address` — single recipient's claim/vesting/payout status.
- `GET /recipients/:address/eligibility` — cross-campaign eligibility lookup for the claim portal (all campaigns where this address has a pending claim/release).
- `GET /recipients/:address/proof?campaignId=:id` — (airdrop) fetch the Merkle proof for a specific recipient + campaign, used client-side to submit the claim transaction.

## Vesting

- `GET /campaigns/:id/vesting/:address` — vested/released/locked breakdown and next unlock time.

## Batch payout

- `POST /campaigns/:id/batches` — dashboard-computed batch chunks (recipient sublists sized for gas limits) for the creator to execute sequentially.
- `GET /campaigns/:id/batches/:batchId` — status of a submitted batch (pending/confirmed/failed, per-recipient results).

## Uploads

- `POST /uploads/csv` — upload and validate a recipient CSV (checks: valid addresses, no duplicates, positive amounts); returns a reference used in campaign creation plus any validation warnings.

## Auth

- `POST /auth/nonce` — get a nonce to sign for wallet-based login.
- `POST /auth/verify` — verify signed nonce, issue session token.

## Notes

- All endpoints that return on-chain-derived state should include a `lastIndexedBlock` field so the frontend can show data freshness and detect indexer lag.
- Write endpoints that mutate campaign state (deploy, batch execution records) should be idempotent where possible — resubmitting a confirmed tx hash should not create duplicate records.
