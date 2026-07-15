# PRD — DISTRO

## Problem

Projects launching tokens on Monad need to distribute them to many recipients — airdrops to communities, vesting for team/investors, one-off payouts for rewards or grants. Today this means custom scripts, one-off Merkle tree generation, hand-rolled vesting contracts, and no shared dashboard to track who's claimed what. It's error-prone and gets rebuilt from scratch by every team.

## Goal

A single platform where a project can create a distribution campaign (airdrop, vesting, or batch payout), fund it, and let recipients claim — with a dashboard for the creator and a claim portal for recipients, backed by audited, reusable contracts on Monad.

## Users

- **Campaign creators**: token projects, DAOs, grant programs — need to define a recipient list, choose a distribution type, fund it, and monitor claims.
- **Recipients**: wallet holders who are owed tokens — need a simple way to check eligibility and claim.

## Scope — v1

- Campaign types: **Merkle airdrop** (claim-based), **vesting schedule** (cliff + linear release), **batch payout** (direct push, no claim step).
- Dashboard: connect wallet, create campaign, upload recipient list (CSV), generate Merkle tree where applicable, deploy campaign contract, fund it, monitor claim/release status.
- Claim portal: recipient connects wallet, sees eligibility across campaigns, claims.
- Single supported token standard: ERC-20 (Monad-compatible).

## Out of scope — v1

- NFT distribution.
- Multi-chain (Monad only for v1).
- On-chain governance over campaign parameters.
- Fiat on/off-ramp.

## Success metrics

- Time from "connect wallet" to "campaign deployed" under 10 minutes for a first-time creator.
- Claim transaction success rate > 99% (no failed claims due to platform bugs).
- Zero funds lost or stuck due to contract bugs (this is the bar, not a stretch goal).

## Key risks

- Contract security — distribution contracts hold real funds; needs thorough testing and, before mainnet, an audit.
- Merkle tree correctness — bad tree generation silently locks recipients out; needs strong test coverage and a verification step in the dashboard before deploy.
- Monad-specific gotchas — chain is new; confirm assumptions about gas, finality, and tooling support rather than porting Ethereum assumptions blindly (use `monskills` skill for this).
