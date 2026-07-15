# User flows — DISTRO

## 1. Creator: launch an airdrop

1. Connect wallet on the dashboard.
2. Select "New Campaign" → "Airdrop".
3. Upload CSV (address, amount).
4. Dashboard validates the list, shows total token amount required, generates the Merkle tree, and displays the root plus a spot-check tool (enter an address → see its computed proof/amount).
5. Creator reviews and confirms → dashboard prompts a wallet transaction to deploy the campaign contract via the factory.
6. Creator funds the campaign contract (approve + transfer, or transfer directly if using a pull pattern).
7. Campaign goes live; creator gets a shareable claim link.
8. Creator monitors claims on the campaign dashboard over time.

## 2. Recipient: claim an airdrop

1. Recipient opens the claim link (or the general claim portal) and connects their wallet.
2. Portal checks eligibility against indexed campaign data, shows claimable amount.
3. Recipient clicks "Claim" → wallet prompts a transaction.
4. Contract verifies the Merkle proof, transfers tokens, marks the address as claimed.
5. Portal confirms success and shows updated (zero) claimable balance for that campaign.

## 3. Creator: set up vesting for team allocations

1. Connect wallet → "New Campaign" → "Vesting".
2. Upload CSV (address, amount, optional per-row cliff/duration overrides) or set campaign-wide defaults.
3. Review computed vesting curve preview per recipient.
4. Confirm → deploy vesting contract via factory → fund it.
5. Dashboard tracks vested/released/locked per recipient over time.

## 4. Recipient: release vested tokens

1. Recipient connects wallet on the claim portal.
2. Portal shows currently-vested-and-unreleased amount for each active vesting campaign.
3. Recipient clicks "Release" → wallet prompts a transaction → contract transfers the vested amount.
4. Portal updates the remaining locked/vesting timeline.

## 5. Creator: run a batch payout

1. Connect wallet → "New Campaign" → "Batch Payout".
2. Upload CSV (address, amount).
3. Dashboard chunks the list into batches sized to stay under gas limits, shows estimated total gas cost.
4. Creator confirms → dashboard submits batch transaction(s) sequentially, showing per-batch status.
5. Dashboard shows final per-recipient sent/failed status; failed sends can be retried individually.
