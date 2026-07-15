# Contract spec — DISTRO

Draft architecture. Interfaces will firm up once contract scaffolding starts in Foundry — treat this as the starting design, not a frozen spec.

## Architecture overview

```
DistroFactory
 ├── deploys → MerkleAirdrop   (per airdrop campaign)
 ├── deploys → VestingSchedule (per vesting campaign)
 └── deploys → BatchPayout     (per batch payout, or executed directly without a persistent contract)
```

All campaign contracts are deployed per-campaign (not shared/multiplexed) for isolation: a bug or exploit in one campaign cannot touch funds in another.

## `DistroFactory`

- `createAirdrop(token, merkleRoot, claimDeadline) → address`
- `createVesting(token, cliffDefault, durationDefault) → address`
- `createBatchPayout(token) → address` (or batch payouts may skip a persistent contract and execute via a stateless multisend call — decide during implementation based on gas/audit tradeoffs)
- Emits `CampaignCreated(campaignType, campaignAddress, creator, token)` for indexing.
- Tracks `campaigns(creator) → address[]` for on-chain discoverability (secondary to off-chain indexing).

## `MerkleAirdrop`

- Storage: `token`, `merkleRoot`, `claimDeadline`, `mapping(address => bool) claimed`.
- `claim(address recipient, uint256 amount, bytes32[] proof)`:
  - Reverts if already claimed.
  - Reverts if proof invalid for `(recipient, amount)` against `merkleRoot`.
  - Reverts if `claimDeadline` set and passed.
  - Transfers `amount` of `token` to `recipient`; sets `claimed[recipient] = true`.
- `recoverUnclaimed(address to)`: creator-only, callable only after `claimDeadline`; sweeps remaining balance.
- Reentrancy guard on `claim`.

## `VestingSchedule`

- Storage per recipient: `totalAmount`, `cliff`, `duration`, `start`, `released`.
- `vestedAmount(address recipient) → uint256`: linear vesting after cliff, capped at `totalAmount`.
- `release(address recipient)`: transfers `vestedAmount - released` to `recipient`; anyone can call on behalf of the recipient (funds always go to the recipient address, not the caller).
- No revocation in v1 (see [ROADMAP.md](ROADMAP.md) for revocable vesting as a later addition — would need an explicit `revoke` function and creator-held revocation rights, called out clearly in the campaign UI if enabled).

## `BatchPayout`

- `payout(address[] recipients, uint256[] amounts)`: creator/executor-only, transfers directly, one event per transfer for indexing.
- Caller is responsible for chunking recipient lists client-side to stay within a safe gas budget; contract does not enforce a max batch size but the dashboard should.
- Partial-failure handling: if the underlying token transfer can fail per-recipient (e.g. blocklists), consider a try/catch-per-transfer pattern so one bad recipient doesn't revert the whole batch — needs a decision once the target token behavior is known.

## Security considerations

- All campaign contracts should be checked against reentrancy, especially `claim`/`release` (transfer-then-effects vs effects-then-transfer — use checks-effects-interactions).
- Merkle tree leaf encoding must be fixed and documented (e.g. `keccak256(abi.encodePacked(address, uint256))`) and matched exactly between off-chain generation and on-chain verification — mismatches are a common source of "valid" airdrops that no one can claim.
- Before mainnet: full test suite in Foundry (unit + fuzz), then an external audit given these contracts hold real funds.
- Confirm Monad-specific EVM behavior (gas costs, precompiles, any deviations from mainnet Ethereum) via the `monskills` skill before assuming Ethereum-standard behavior.

## Open questions

- Exact vesting curve beyond linear (graded/step vesting)? Deferred to v2 per [ROADMAP.md](ROADMAP.md).
- Should `BatchPayout` be a deployed contract per campaign or a single stateless multisend utility? Affects gas and indexing design — decide when implementation starts.
