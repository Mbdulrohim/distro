# Roadmap — DISTRO

## Phase 0 — Foundation

- Scaffold Foundry contracts project, Next.js dashboard, backend API + Postgres.
- Wire up `monskills` for Monad-specific contract/wallet patterns and `impeccable` for UI review.
- Deploy to Monad testnet.

## Phase 1 — Airdrop (v1 core)

- `DistroFactory` + `MerkleAirdrop` contracts, full test coverage.
- Dashboard: CSV upload → Merkle tree generation → deploy → fund → monitor.
- Claim portal: eligibility check + claim flow.
- Indexer for claim events.

## Phase 2 — Vesting

- `VestingSchedule` contract (cliff + linear), full test coverage.
- Dashboard vesting campaign creation + per-recipient schedule preview.
- Claim portal: release flow + vesting timeline view.

## Phase 3 — Batch payout

- `BatchPayout` contract or stateless multisend (decide per [CONTRACT_SPEC.md](CONTRACT_SPEC.md) open question).
- Dashboard batching/chunking + execution + retry-on-failure UX.

## Phase 4 — Hardening for mainnet

- External contract audit.
- Load-test indexer against high-volume campaigns.
- Recovery/edge-case handling (stuck funds, reorg handling, RPC failover).
- Mainnet deployment.

## Post-v1 (unscoped)

- Graded/step vesting curves, revocable vesting.
- NFT distribution support.
- Multi-chain beyond Monad.
- Notifications (email/webhook) on claim/release.
- Public campaign discovery page.
