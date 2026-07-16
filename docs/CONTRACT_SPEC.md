# Contract spec — Distro

> Draft architecture for the push-based distribution engine described in [PRD.md](PRD.md). Interfaces firm up once Foundry work starts — this is the starting design, not a frozen spec.
>
> Supersedes the pre-definition draft (Merkle-claim airdrop + vesting). Distro has **no claim step**.

## The decision that shapes everything: escrow + permissionless execution

Distro must be a **payment scheduler** and a **payroll engine**, but explicitly **not a custodian**. Those pull in opposite directions: a scheduled run has to execute while the user is offline, without Distro holding funds or keys.

**Chosen model:** the creator pre-funds a per-distribution escrow contract at creation. At the scheduled time, **execution is permissionless** — anyone may trigger it, and the contract can only pay the committed recipient set (or refund the creator). Distro operates a keeper for convenience, **not** as a trust or liveness dependency: if Distro is down, the creator or any third party can trigger the run.

Rejected alternatives, for the record:

- **Approve + Distro relayer `transferFrom`.** Capital-efficient, but requires a standing allowance over the user's balance (permanent exploit surface), makes Distro's relayer a single point of failure for payroll, and puts Distro in control of when funds move — too close to the custodian line the product explicitly disclaims.
- **EIP-7702 delegation / session keys.** Monad-native and elegant, but account-wide delegation risk, least battle-tested for real funds, plus Monad-specific constraints (10 MON reserve floor, no CREATE/CREATE2 in delegated context). Revisit post-v1.

Accepted cost: capital is locked between funding and execution. Acceptable for payroll/grants, where the funds were leaving anyway and the window is short.

> This decision was made on the user's behalf after a "no preference" answer. It is reversible only at high cost once audited — challenge it now if the tradeoff is wrong.

## Architecture overview

```
DistributionFactory
 └── clones (EIP-1167 minimal proxy) → Distribution   (one per distribution)
```

Per-distribution isolation means a bug or exploit in one distribution cannot reach another's funds. Minimal proxies (OpenZeppelin `Clones`) keep deployment cheap enough to afford that isolation per distribution.

## Recipient list: commitment, not storage

Storing a recipient list onchain costs ~20k gas per entry — prohibitive at payroll scale (1,000 recipients ≈ 20M gas just to store).

Instead, the list is **committed to** at creation and **supplied at execution**:

- Creation stores an array of **chunk hashes**: `chunkHashes[i] = keccak256(abi.encode(recipients_i, amounts_i))`.
- Execution submits a chunk's actual `recipients[]` / `amounts[]` in calldata; the contract recomputes the hash and rejects any mismatch.

This keeps a permissionless executor honest — they cannot substitute a different recipient set — at a fraction of the storage cost. It is **not** a Merkle claim tree: recipients never prove anything, and never transact.

Chunking is mandatory regardless, since a large list exceeds any block's gas limit.

## `DistributionFactory`

- `createDistribution(token, chunkHashes[], totalAmount, executeAfter) → address`
- Emits `DistributionCreated(distribution, creator, token, totalAmount, executeAfter, chunkCount)` for indexing.
- Tracks `distributionsOf(creator) → address[]` for onchain discoverability (secondary to the offchain indexer).
- Holds `protocolFeeBps` + `treasury`, applied at funding. **Ships set to 0** but the mechanism exists from day one — retrofitting a fee post-audit means re-auditing (see [CTO_REVIEW.md](CTO_REVIEW.md)).
- `paused` blocks **creation of new distributions only**. It must never be able to freeze, seize, or redirect an already-funded distribution — those funds stay executable and refundable regardless. Pausing emits a loud event; no silent freezes.
- Owner is a **Safe multisig**, never an EOA (deploy via the `monskills` `wallet` skill).

## `Distribution`

State: `Created → Funded → Executing → Completed | Cancelled`

Storage: `token`, `creator`, `executeAfter`, `totalAmount`, `chunkHashes[]`, `chunkExecuted` bitmap, `failedAmount`, `state`.

### `fund()`
Pulls `totalAmount` (+ fee, if non-zero) from the creator via `SafeERC20.safeTransferFrom`. Moves state to `Funded`. Verifies the received balance actually equals the expected amount — this is what rejects fee-on-transfer / rebasing tokens rather than silently under-paying recipients later.

### `executeChunk(uint256 chunkIndex, address[] recipients, uint256[] amounts)`
- Reverts unless `state == Funded | Executing`.
- Reverts if `block.timestamp < executeAfter` — this *is* the schedule.
- Reverts if `chunkExecuted[chunkIndex]` already set.
- Reverts unless `keccak256(abi.encode(recipients, amounts)) == chunkHashes[chunkIndex]`.
- Marks the chunk executed **before** transferring (checks-effects-interactions).
- Transfers each recipient's amount via `SafeERC20`, **wrapped per-recipient in try/catch**.
- Emits `Paid(recipient, amount, chunkIndex)` per success and `PaymentFailed(recipient, amount, chunkIndex, reason)` per failure.
- **Callable by anyone.** No `onlyOwner`, no `onlyCreator` — that is the whole point.

### Per-recipient failure isolation
A single bad recipient (token blocklist, non-standard token behavior) must not revert an entire payroll chunk. Failed transfers are recorded, their value accrues to `failedAmount`, and the rest of the chunk still pays out.

This directly serves a problem the product exists to solve — *"retry failed transfers"* is in the PRD's problem statement, not an edge case.

### `retry(address[] recipients)`
Re-attempts previously failed payments. Permissionless; funds can only go to the originally committed recipients.

### `cancel()`
Creator-only, only while `state == Funded` and before `executeAfter`. Refunds the full balance to the creator, state → `Cancelled`.

### `reclaim()`
Creator-only, after all chunks are executed. Sweeps `failedAmount` (payments that could not be delivered) back to the creator. Cannot touch undelivered-but-still-retryable funds before execution completes.

## Security considerations

- **`SafeERC20` everywhere.** Never raw `IERC20.transfer` — tokens that don't return a `bool` fail silently otherwise.
- **Checks-effects-interactions** plus a reentrancy guard on `executeChunk` / `retry`.
- **Exclude ERC-777 / callback-capable tokens.** Transfer hooks are a reentrancy vector even with a guard on the calling function, since the callback can re-enter a *different* function.
- **Reject fee-on-transfer / rebasing tokens at `fund()`** via the balance-delta check. The alternative is silently shorting the last recipients.
- **Chunk hash encoding must be fixed and documented** (`abi.encode`, not `abi.encodePacked` — packed encoding of two dynamic arrays is ambiguous and collision-prone). Offchain chunk generation must match onchain verification exactly.
- **Gas limits are a real cost on Monad**, which charges on `gas_limit` rather than gas used. Chunk sizing and limit estimation must come from the `monskills` `gas` skill — a padded limit costs the executor real money on every run.
- **No admin path to user funds.** The factory owner can pause new creation and set fees; it can never move a funded distribution's tokens. Verify this holds in tests, not just in review.
- Before mainnet: full Foundry suite (unit + fuzz + invariant), static analysis (Slither), then an external audit.

## Invariants worth fuzzing

1. Sum of all `Paid` + `failedAmount` + refunds never exceeds `totalAmount`.
2. No recipient is ever paid twice for the same chunk.
3. No chunk executes before `executeAfter`.
4. A `Cancelled` distribution can never pay anyone.
5. Contract token balance reaches zero only via recipient payment or creator refund/reclaim.

## Open questions

- **Native MON distribution** — v1 is ERC-20 only. Native transfers introduce call-based reentrancy and gas-forwarding griefing; needs its own design pass.
- **Recurring schedules (v2)** — repeat-funding per cycle, or one contract with N scheduled tranches? Affects whether `Distribution` needs cycle state or stays single-shot. Deferred per [ROADMAP.md](ROADMAP.md).
- **Keeper incentive** — if Distro's convenience keeper is down, who pays gas to trigger a run? Creator self-serve covers it for v1, but a gas rebate/tip may be needed to make third-party execution actually attractive.
- **Chunk size default** — must be derived from real Monad gas measurements, not guessed.
