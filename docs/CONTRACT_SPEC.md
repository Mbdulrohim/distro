# Contract spec — Distro

> Draft architecture for the push-based distribution engine described in [PRD.md](PRD.md). Interfaces firm up once Foundry work starts — this is the starting design, not a frozen spec.
>
> **v2** — incorporates the corrections from [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md). Distro has **no claim step**; recipients never transact.

## The decision that shapes everything: escrow + permissionless execution

Distro must be a **payment scheduler** and a **payroll engine**, but explicitly **not a custodian**. Those pull in opposite directions: a scheduled run has to execute while the creator is offline, without Distro holding funds or keys.

**Chosen model:** the creator funds a per-distribution escrow contract. At the scheduled time, **execution is permissionless** — anyone may trigger it, and the contract can only pay the committed recipient set (or refund the creator). Distro operates a keeper for convenience, **not** as a trust or liveness dependency.

That property is only real if a third party can actually _reconstruct_ what to execute. See "Data availability" below — the v1 draft got this wrong, and it invalidated the entire rationale.

Rejected alternatives:

- **Approve + Distro relayer `transferFrom`.** Requires a standing allowance over the creator's balance (permanent exploit surface), makes Distro's relayer a single point of failure for payroll, and puts Distro in control of when funds move — too close to the custodian line the product disclaims.
- **EIP-7702 delegation / session keys.** Monad-native and elegant, but account-wide delegation risk, least battle-tested for real funds, plus Monad constraints (10 MON reserve floor, no CREATE/CREATE2 in delegated context). Revisit post-v1.

> Chosen on the user's behalf after a "no preference" answer. Reversible now; expensive after audit.

## Data availability: the recipient list must be reconstructable from the chain

Storing a recipient list in contract storage costs ~20k gas per entry — prohibitive at payroll scale. But committing to _only_ a hash puts the list exclusively in Distro's database, which would mean **nobody but Distro can execute** — reintroducing the exact liveness dependency escrow exists to remove, and making "verifiable onchain" false.

**Resolution:** the creator submits each chunk's recipient payload at commit time. The contract hashes it, sums it, and **emits it as event data** (~8 gas/byte, vs ~20,000 per storage slot). Anyone can rebuild any chunk from logs, forever.

Because the contract sees the real payload at commit time, it also **computes `totalAmount` itself** rather than trusting a creator-supplied number — the "escrow might not cover the payments" failure mode simply doesn't exist.

### Canonical payload encoding (normative)

One encoding, used identically for the commitment, the event, and execution calldata. Offchain generation and onchain verification cannot drift, because there is only one format.

```
payload = concat( entry_0, entry_1, ... entry_n )
entry   = abi.encodePacked(address recipient, uint128 amount)   // 20 + 16 = 36 bytes
```

`uint128` caps a single payment at ~3.4e38 base units (~3.4e20 tokens at 18 decimals) — headroom for any real token, including high-supply ones where `uint96` would have failed. Validated at commit.

| Recipients | Payload | Approx. event gas |
| ---------- | ------- | ----------------- |
| 100        | 3.6 KB  | ~29k              |
| 1,000      | 36 KB   | ~290k             |

A one-time creation cost, paid by the creator, that makes permissionless execution real.

Rejected: IPFS/blob + CID onchain. Cheaper, but reintroduces an availability dependency on a pinning service — the same class of bug being fixed.

## Architecture overview

```
DistributionFactory
 └── cloneDeterministic (EIP-1167) → Distribution   (one per distribution)
```

Per-distribution isolation: a bug or exploit in one distribution cannot reach another's funds. Minimal proxies keep that isolation affordable. CREATE2 gives deterministic addresses (the dashboard can show the escrow address before deployment) and provides the idempotency key.

Clones are **immutable**. The factory can point _new_ distributions at a new implementation; live ones are frozen forever. This is deliberate, and it is a product promise: a bug found post-launch cannot be patched for in-flight distributions, only for new ones.

## `DistributionFactory`

- `createDistribution(token, executeAfter, chunkCount, salt) → address`
  - Deploys via `Clones.cloneDeterministic(implementation, keccak256(creator, salt))`.
  - **Reverts on a duplicate `(creator, salt)`** — this is the double-funding guard. A double-click, an RPC retry, or an impatient user on Monad's ~400ms blocks must not produce two payrolls. In a push model there is no clawback.
- Emits `DistributionCreated(distribution, creator, token, executeAfter, chunkCount)`.
- `distributionsOf(creator) → address[]` for onchain discoverability (secondary to the indexer).
- `protocolFeeBps` + `treasury`, applied at funding. **Ships at 0**; the mechanism exists from day one so monetization doesn't force a re-audit (see [ROADMAP.md](ROADMAP.md) — the fee _basis_ is still an open decision, and a per-recipient basis would move this hook).
- `paused` blocks **creation of new distributions only**. It can never freeze, seize, or redirect a funded distribution — those funds stay executable and refundable regardless. Pausing emits a loud event.
- Owner is a **Safe multisig**, never an EOA (monskills `wallet` skill).

## `Distribution`

### States

```
Draft ──commitChunk×N──▶ Ready ──fund()──▶ Funded ──executeChunk──▶ Executing ──▶ Completed
  │                        │                  │                         │
  └────────────cancel()────┴──────────────────┘                         │
                                   (no chunk executed yet)              │
                                                                  reclaim()
```

- **Draft** — deployed; chunks being committed.
- **Ready** — all chunks committed; `totalAmount` known; awaiting funds.
- **Funded** — escrow holds the tokens.
- **Executing** — at least one chunk executed.
- **Completed** — every chunk executed (or abandoned via `reclaim`).
- **Cancelled** — refunded before any execution.

Storage: `token`, `creator`, `executeAfter`, `totalAmount`, `totalPaid`, `failedAmount`, `chunkCount`, `committedCount`, `executedCount`, `chunkHashes[]`, `chunkExecuted` bitmap, `failed` map keyed by `(chunkIndex, position)`, `state`, `reclaimed`.

### `commitChunk(uint256 chunkIndex, bytes calldata payload)`

Creator-only, `state == Draft`.

- Reverts if `chunkIndex` already committed or `>= chunkCount`.
- Reverts unless `payload.length % 36 == 0` and non-empty.
- Iterates entries: rejects `recipient == address(0)` (burning funds), accumulates `totalAmount += amount`.
- `chunkHashes[chunkIndex] = keccak256(abi.encode(address(this), chunkIndex, payload))` — bound to this distribution and index, so a payload can never be replayed against a different chunk or contract.
- **Emits `RecipientsCommitted(chunkIndex, payload)`** — the data-availability guarantee.
- When `committedCount == chunkCount`, state → `Ready`.

Chunk sizing is a client concern (see "Gas" below), but large distributions necessarily commit across several transactions — 10,000 recipients cannot fit one block.

### `fund()`

`state == Ready`. Callable by anyone (a treasury multisig may not be the creator), **at any time before execution**.

- Pulls `totalAmount` + fee via `SafeERC20.safeTransferFrom`.
- **Verifies the received balance delta equals the expected amount** — this rejects fee-on-transfer and rebasing tokens outright rather than silently shorting the last recipients.
- Forwards the fee to `treasury`; state → `Funded`.

**Funding is deliberately decoupled from creation.** The creator schedules Friday's payroll on Monday and funds it Thursday night — the lock-up window is their choice, not a tax the architecture imposes. The cost is a "Ready but unfunded" state that no-ops at execution time; the dashboard must surface that loudly (and it is the obvious first notification use case).

### `executeChunk(uint256 chunkIndex, bytes calldata payload)`

**Callable by anyone.** No `onlyOwner`, no `onlyCreator` — that is the entire point.

- Reverts unless `state ∈ {Funded, Executing}` and `!reclaimed`.
- Reverts if `block.timestamp < executeAfter` — this _is_ the schedule, enforced onchain rather than by Distro.
- Reverts if `chunkExecuted[chunkIndex]`.
- Reverts unless `keccak256(abi.encode(address(this), chunkIndex, payload)) == chunkHashes[chunkIndex]`.
- Marks the chunk executed **before** transferring (checks-effects-interactions), `nonReentrant`.
- Per entry:
  - **`if (gasleft() < MIN_GAS_PER_TRANSFER) revert InsufficientGas();`** — see below. Non-negotiable.
  - Reverts with `InsufficientEscrow(shortfall)` if `totalPaid + amount > totalAmount`.
  - `try` `SafeERC20.safeTransfer` → `Paid(recipient, amount, chunkIndex, position)`; `catch` → record `failed[(chunkIndex, position)]`, `failedAmount += amount`, emit `PaymentFailed(recipient, amount, chunkIndex, position, reason)`.
- When `executedCount == chunkCount`, state → `Completed`.

#### The gas floor is a security control, not an optimization

Without it, permissionless execution + try/catch + EIP-150's 63/64 rule is exploitable: an attacker calls `executeChunk` with just enough gas to pass the hash check and enter the loop, but too little for the inner transfers. Every `try` runs out of gas, every `catch` swallows it, and **every recipient is recorded as failed** while the chunk marks itself executed. `retry` is permissionless too, so this repeats indefinitely. Cost to the attacker: one cheap transaction. Cost to Distro: payroll never lands.

The floor turns silent poisoning into a clean revert that writes no state. `MIN_GAS_PER_TRANSFER` must come from **measured Monad gas** for the target tokens, not guessed — cold state access is 3–4× Ethereum's (monskills `gas`).

The governing invariant: **a chunk execution either records true outcomes or reverts entirely.** Fuzz this first.

### Per-recipient failure isolation

One blocklisted recipient (USDC-class) must not revert an entire payroll chunk. Failures are recorded per `(chunkIndex, position)` and the rest of the chunk pays out. _"Retry failed transfers"_ is in the PRD's problem statement — this is core, not an edge case.

### `retry(uint256 chunkIndex, bytes calldata payload, uint256[] positions)`

Permissionless. Re-attempts previously failed entries **keyed by `(chunkIndex, position)`, never by address** — duplicate addresses across chunks are legal by design, and address-keyed retry is where double-pay bugs live.

- Verifies the payload hash exactly as `executeChunk` does.
- Reverts unless each `position` is currently marked failed.
- Same gas floor per entry.
- On success: clears the failed flag, `failedAmount -= amount`, `totalPaid += amount`.

### `cancel()`

Creator-only. Allowed while **no chunk has executed** (`executedCount == 0`), in `Draft` or `Funded` — **regardless of `executeAfter`**.

Gating on execution progress rather than time closes a hole in the v1 draft where a funded distribution past `executeAfter` that nobody executed could be neither cancelled (time-barred) nor reclaimed (never completed) — the creator's funds stranded forever, with no admin path by design.

It is also strictly more useful: a creator can call off Friday's payroll on Friday morning. It's their money.

Refunds the full balance; state → `Cancelled`. A cancelled distribution can never pay anyone.

### `reclaim()`

Creator-only. Callable when **`state == Completed`** (sweeping `failedAmount` — payments that could not be delivered) **or** when **`block.timestamp > executeAfter + GRACE_PERIOD`** with chunks still unexecuted (sweeping the remainder).

Sets `reclaimed = true`, which blocks further execution — otherwise a chunk executing after a sweep would fail on insufficient balance.

`GRACE_PERIOD` (proposed: 7 days) exists so a creator cannot front-run a legitimate keeper execution. It is the escape hatch for "nobody ever executed" — keeper down, gas exceeds value, token paused indefinitely.

## Security considerations

- **`SafeERC20` everywhere.** Never raw `IERC20.transfer` — tokens that don't return a `bool` fail silently otherwise.
- **Checks-effects-interactions** + `nonReentrant` on `executeChunk` / `retry` / `fund`.
- **Exclude ERC-777 / callback-capable tokens.** Transfer hooks are a reentrancy vector even with a guard on the calling function, since the callback can re-enter a _different_ one.
- **Reject fee-on-transfer / rebasing at `fund()`** via the balance-delta check.
- **The payload encoding is normative.** Contract and offchain generator must produce identical bytes or the distribution is unexecutable. One format, used for commitment + event + execution, is the mitigation.
- **Gas is charged on `gas_limit` on Monad, not gas used.** A padded limit costs the executor real money on every run. Chunk size and `MIN_GAS_PER_TRANSFER` must come from measurement (monskills `gas`).
- **Monad async execution** — ~3-block delayed state view. Keeper and dashboard must gate execution reads on `safe`/`finalized`, not `latest`; an eager keeper firing against a not-yet-visible balance records spurious failures. The **10 MON reserve floor applies to the keeper EOA** — a keeper below it silently stops sending. That's an alerting requirement.
- **No admin path to user funds.** The factory owner can pause new creation and set fees; it can never move a funded distribution's tokens. Prove this in tests, not review.
- Before mainnet: full Foundry suite (unit + fuzz + invariant), Slither in CI, then an external audit.

## Invariants to fuzz

1. **A chunk execution either records true outcomes or reverts entirely.** (The gas-griefing invariant — highest priority.)
2. `totalPaid + failedAmount + refunded` never exceeds `totalAmount`.
3. No `(chunkIndex, position)` is ever paid twice.
4. No chunk executes before `executeAfter`.
5. A `Cancelled` distribution can never pay anyone.
6. Contract balance reaches zero only via recipient payment or creator refund/reclaim.
7. `totalAmount` always equals the sum of all committed payload amounts.
8. After `reclaimed`, no execution can succeed.

## Open decisions — these change the contract, not the UI

**O1 — Does "scheduled" guarantee a recipient anything?** With cancel-any-time-before-execution, a scheduled distribution is a _promise_, not an escrow guarantee. Correct for payroll (employers can cancel). Wrong for bounties/grants, where credible commitment is the point. An **`irrevocable` flag** set at creation (waiving `cancel`, keeping only post-grace `reclaim`) is cheap now and impossible to retrofit into an immutable clone. **Needs a decision before implementation.**

**O2 — Who executes, and why?** Permissionless execution is only real if someone besides Distro is _motivated_. Today nobody is: no tip, no rebate, no MEV. The honest fallback is "the creator self-serves," which is fine — but then say that, rather than implying a keeper ecosystem. A small gas tip skimmed from escrow on execution would make third-party execution self-sustaining and genuinely remove Distro from the critical path. This is the difference between the property being architectural and aspirational. **Needs a decision before implementation.**

**O3 — Recurring (v2) shapes v1 today.** If recurring means one contract with N tranches, `Distribution` needs cycle state and v1 should reserve room. If it means N independent distributions from a saved template, v1 needs nothing. Deferring the _feature_ is right; deferring this _decision_ risks a v2 that cannot reuse v1's audited contract.

**O4 — Token allowlist.** Fee-on-transfer/rebasing are rejected at funding, but nothing curates known-broken tokens, and USDC-class blocklists produce failures that look like Distro bugs. Curated allowlist for v1, or accept and document?

**O5 — Native MON distribution.** v1 is ERC-20 only. Native transfers introduce call-based reentrancy and gas-forwarding griefing; needs its own design pass.

## Sequence before any Solidity

1. Answer **O1** and **O2** — both are contract-shape decisions.
2. Freeze the payload encoding as a normative spec shared by contract and generator.
3. Measure real Monad gas for a batch transfer → derive `MIN_GAS_PER_TRANSFER` and the default chunk size.
4. Then write `Distribution` + `DistributionFactory` against the invariants above.
