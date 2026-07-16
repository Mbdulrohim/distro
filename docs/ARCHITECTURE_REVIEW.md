# Architecture Review — Distro v1, pre-implementation

Adversarial review of [CONTRACT_SPEC.md](CONTRACT_SPEC.md), [DATABASE.md](DATABASE.md), [FEATURES.md](FEATURES.md), [USER_FLOW.md](USER_FLOW.md), [API.md](API.md), [PRD.md](PRD.md).

Most of this design was decided on the user's behalf after "[No preference]" answers, so it has never been challenged. This document challenges it. Findings are ordered by severity, not by politeness.

**Nothing here is implemented.** These are corrections to make *before* Foundry work starts.

> **Status (2026-07-16): C1, C2, C3, H1, H2, H3, H4, M1, M2, M3, M5 are folded into [CONTRACT_SPEC.md](CONTRACT_SPEC.md) v2 and [DATABASE.md](DATABASE.md).** H1 was resolved more completely than proposed below: because the contract now receives the real payload at commit time (the C1 fix), it hashes *and sums* it, so `totalAmount` is computed onchain rather than trusted from the creator — the failure mode is gone rather than merely loud.
>
> **Still open:** M4 (token allowlist) and O1–O5, which are decisions rather than corrections. O1 and O2 block implementation and are tracked in [ROADMAP.md](ROADMAP.md).
>
> This document is retained as the rationale record — the *why* behind v2's shape. It is not a to-do list.

---

## 🔴 C1 — The permissionless-execution guarantee is currently fake

**This invalidates the headline claim of the whole architecture.**

The spec stores only `chunkHashes[]` onchain and requires the executor to supply `recipients[]` / `amounts[]` in calldata. It then claims execution is permissionless and that a run survives Distro disappearing.

It does not. **The recipient list exists only in Distro's private database.** A third party cannot execute a chunk, because they cannot know what to pass. If Distro's database is lost, or Distro shuts down, or simply refuses, then:

- No one but Distro can execute the distribution.
- The escrowed funds are stranded (only the creator's cancel/reclaim path remains).
- "Works even if your team disappears" is false.
- "Distro's keeper is a convenience, not a dependency" is false — it is the *only* party able to execute.

The entire justification for choosing escrow over the allowance+relayer model was that it removes Distro as a liveness dependency. Without data availability, escrow reintroduces exactly that dependency, and we paid for it with locked capital and got nothing.

It also breaks a second claim: PRD says every distribution is *verifiable onchain*, and the escrow rationale says recipients can see funds are covered. With only hashes onchain, nobody can verify their own allocation, or that `totalAmount` covers the sum of amounts.

### Fix: emit the recipient list as event data at creation

Event data (`LOG`) costs ~8 gas/byte versus ~20,000 gas per storage slot. Emit the full list once at creation; anyone can reconstruct it from logs forever.

```
event RecipientsCommitted(uint256 indexed chunkIndex, bytes payload)
```

Packing `address` (20 bytes) + `uint96` amount (12 bytes) into a single 32-byte word keeps it tight:

| Recipients | Payload | Approx. gas |
|---|---|---|
| 100 | 3.2 KB | ~26k |
| 1,000 | 32 KB | ~260k |
| 10,000 | 320 KB | ~2.6M (across several creation txs) |

A one-time cost at creation, paid by the creator, that makes the permissionless property real. `uint96` caps an individual payment at ~7.9e28 base units (79 billion tokens at 18 decimals) — fine for every stated use case, but it must be validated at creation, not assumed.

Alternative considered: IPFS/blob with the CID onchain. Cheaper, but reintroduces an availability dependency on a pinning service — the same class of bug we're fixing. Reject for v1.

**Consequence:** with event-based DA, the offchain DB becomes a pure cache (which [DATABASE.md](DATABASE.md) already claims it is, but currently isn't — it holds unique, unrecoverable data). That claim only becomes true once this fix lands.

---

## 🔴 C2 — Gas-griefing: an attacker can mark healthy recipients as "failed"

`executeChunk` wraps each transfer in try/catch to isolate failures. Combined with permissionless execution and EIP-150's 63/64 gas rule, this is exploitable.

An attacker calls `executeChunk` with a gas limit just high enough to pass the hash check and enter the loop, but too low for the inner transfers. Each `try` sub-call runs out of gas, the `catch` swallows it, and the recipient is recorded as **failed**. The chunk is marked executed. Result: a payroll run completes with every payment "failed" — no signature forged, no funds stolen, but the run is poisoned and the creator must pay again to retry.

`retry` is permissionless too, so the attacker can repeat this against every retry attempt, indefinitely. Cost to attacker: one cheap transaction. Cost to Distro: payroll never lands.

### Fix

Require a gas floor before each transfer inside the loop:

```solidity
if (gasleft() < MIN_GAS_PER_TRANSFER + SAFETY_BUFFER) revert InsufficientGas();
```

This converts a silent poisoning into a revert — the whole transaction fails and no state is written. `MIN_GAS_PER_TRANSFER` must be derived from **measured Monad gas costs** for the target tokens, not guessed (per the `monskills` `gas` skill; cold-state access is 3–4× Ethereum's).

This is the single most important invariant to fuzz: *a chunk execution either records true outcomes or reverts entirely.*

---

## 🔴 C3 — Funds can be permanently stranded (state-machine hole)

The spec says:

- `cancel()` — creator-only, **before `executeAfter`**
- `reclaim()` — creator-only, **after all chunks executed**

Neither covers: funded, `executeAfter` has passed, and nobody ever executes (keeper down, creator inactive, gas cost exceeds value, token paused indefinitely).

The distribution is stuck in `Funded`/`Executing` forever. Cancel is time-barred. Reclaim requires a completion that never comes. **The creator's money is gone** — no admin path either, since the factory deliberately can't touch funded distributions.

### Fix

Gate cancellation on **execution progress, not time**:

> `cancel()` is allowed while `state == Funded` **and no chunk has executed**, regardless of `executeAfter`.

This closes the hole and is strictly more useful (a creator can call off Friday's payroll on Friday morning — it's their money). It also removes an arbitrary rule users would trip over.

For partial execution, add:

> `reclaimUnexecuted()` — creator-only, callable once `executeAfter + GRACE_PERIOD` has passed, sweeping funds for chunks that were never executed.

`GRACE_PERIOD` exists so a creator can't front-run a legitimate keeper execution. Recipients in an unexecuted chunk lose nothing they were guaranteed — see O1 on the trust model.

---

## 🟠 H1 — The contract cannot verify that funding covers the payments

At creation the contract holds only hashes; it cannot sum the amounts. So `totalAmount` is an unverified creator-supplied number.

If `totalAmount < Σ amounts`, early chunks pay out and **later chunks fail on insufficient balance** — recipients in the last chunk are silently shorted. Not exploitable against Distro (it's the creator's own money), but it's a correctness failure that only manifests at execution, and it disproportionately punishes whoever sorts last.

### Fix
With C1's event-based DA, anyone can verify offchain, and the dashboard must verify before signing. Onchain, add a cheap invariant: track `totalPaid` and reject a chunk that would exceed `totalAmount`. Full onchain sum verification is impossible without storing the list — accept that, but make the failure loud (`InsufficientEscrow` revert with the shortfall) rather than a generic transfer failure.

---

## 🟠 H2 — Double-funding / double-creation has no idempotency key

Nothing prevents a creator from creating and funding the same distribution twice (double-click, retried tx, impatient user on a slow RPC). Two escrows, two payrolls, everyone paid twice. In a push model there's no clawback.

Monad's ~400ms blocks make this *more* likely, not less: the UI will feel unresponsive relative to block time and users will re-click.

### Fix
- Client-supplied `salt` / idempotency key in `createDistribution`; factory uses `Clones.cloneDeterministic` (CREATE2) and reverts on a duplicate `(creator, salt)`.
- Deterministic addresses are a bonus: the dashboard can show the escrow address before deployment.
- API-level idempotency key on `POST /api/distributions` as defense in depth.

---

## 🟠 H3 — Escrow's capital lock-up is self-inflicted and avoidable

The spec's accepted cost — "capital is locked between funding and execution" — is an artifact of forcing `fund()` at creation. Nothing requires that.

### Fix: decouple creation from funding

Allow `fund()` any time before execution. A creator schedules Friday payroll on Monday and funds it Thursday night. The lock window becomes the creator's choice rather than the architecture's tax, which removes the main real objection to escrow.

Cost: a "scheduled but unfunded" state that silently no-ops at execution time. That's a **product** problem (dashboard must surface it loudly; a reminder is the obvious v1.1 notification use case), not a contract problem — and a far better trade than mandatory lock-up.

This materially weakens the case for ever adding an allowance-based mode.

---

## 🟠 H4 — Monad async execution vs. the create → fund → execute flow

Monad decouples consensus from execution with a ~3-block delayed state view, and newly funded accounts need ~1.2s before they can transact ([monskills `concepts`](../CLAUDE.md)).

The "Execute now" path does `createDistribution` → `fund` → `executeChunk` back-to-back. Reading state (e.g. confirming the escrow is funded) against a delayed view can make the UI show a stale "unfunded" escrow, or an eager keeper can fire `executeChunk` against a not-yet-visible balance and record spurious failures — which C2's griefing analysis shows is expensive to undo.

### Fix
- Keeper and dashboard must gate execution on the appropriate block tag (`safe`/`finalized`), not `latest`.
- The 10 MON reserve-balance floor applies to the **keeper EOA** — a keeper that dips below it silently stops sending. Alerting requirement, not a nice-to-have.
- Verify all of this against `monskills` `concepts` before implementation rather than assuming Ethereum semantics.

---

## 🟡 M1 — Chunk hash should bind the distribution and index

`keccak256(abi.encode(recipients, amounts))` is unbound. Binding is nearly free and removes a class of reasoning:

```
keccak256(abi.encode(address(this), chunkIndex, recipients, amounts))
```

`abi.encode` (not `encodePacked`) is already correctly specified — packed encoding of two dynamic arrays is ambiguous. Keep that, and document the exact preimage as a normative spec, since offchain generation and onchain verification must match byte-for-byte or the distribution is unexecutable.

## 🟡 M2 — `retry` accounting is under-specified

`retry(address[])` doesn't say how `failedAmount` is decremented on success, what happens when the same address appears in multiple chunks (allowed — duplicates are permitted by design), or whether retry can run before all chunks execute. Ambiguity here is where double-pay bugs live. Specify: retry keyed by `(chunkIndex, position)`, not by address.

## 🟡 M3 — No dry-run / test payment

Every payroll operator's first instinct is to send one test payment before committing $200k. There's no supported path. A "test with 1 recipient" flow, or a first-chunk-only execution, is cheap insurance against a class of user error that is otherwise irreversible.

## 🟡 M4 — Token allowlist deferred with no owner

Fee-on-transfer/rebasing are rejected at `fund()`, which is good. But nothing curates *known-broken* tokens, and USDC-class blocklists will produce failures that look like Distro bugs. Decide: curated allowlist for v1, or accept and document.

## 🟡 M5 — DB indexes and RLS unspecified

[DATABASE.md](DATABASE.md) is sound on shape but silent on:
- Indexes for the dashboard's actual query patterns: `(distribution_id, status)`, `(distribution_id, chunk_index, position)`, `(creator_address, created_at desc)`. Distributions run to thousands of rows.
- Concrete RLS policies. "RLS is the entire access-control story" is asserted, then never specified. Write the policies before the first table exists, not after.
- `numeric(78,0)` correctly holds `uint256`; note that C1's `uint96` packing narrows the *per-payment* cap and the validator must enforce it.

---

## Open questions the docs still dodge

**O1 — What does "scheduled" guarantee a recipient?** With cancel-any-time-before-execution (C3), a scheduled distribution is a *promise*, not an escrow guarantee. Correct for payroll (employers can cancel). Wrong for bounties/grants where the point is credible commitment. Should v1 offer an **irrevocable** flag that waives cancellation? It's cheap now and impossible to retrofit without a new contract version.

**O2 — Who pays the keeper's gas, and why would a third party ever execute?** "Permissionless execution" is only real if someone other than Distro is *motivated* to execute. Today nobody is: there's no tip, no rebate, no MEV. The fallback is really "the creator does it themselves," which is fine — but then say that plainly instead of implying a keeper ecosystem. A gas tip skimmed from the escrow would make third-party execution self-sustaining and genuinely remove Distro from the critical path. This is the difference between the property being architectural and being aspirational.

**O3 — Monetization.** Still unanswered, still blocking the audit. The 0-value fee hook is the right hedge, but the *basis* (per distribution, % of volume, per recipient, subscription) changes where the hook lives. A per-recipient fee, for instance, interacts with chunking and gas in ways a flat fee doesn't.

**O4 — Recurring (v2) shapes v1's contract today.** If recurring is one contract with N tranches, `Distribution` needs cycle state and v1 should reserve room. If it's N independent distributions from a saved template, v1 needs nothing and recurring is pure product surface. Deferring the *feature* is right; deferring this *decision* risks a v2 that can't reuse v1's audited contract.

**O5 — Upgrade path.** Clones are immutable (correct). The factory can point new distributions at a new implementation, but live ones are frozen forever. That's the right trade — state it explicitly as a product promise, because it means a bug found post-launch cannot be patched for in-flight distributions, only for new ones.

---

## Recommended sequence before any Solidity is written

1. Accept/reject **C1** (event DA) — it changes the contract's data model and the DB's role. Everything else waits on it.
2. Accept/reject **C3** and **H3** — together they redefine the state machine.
3. Answer **O1** and **O2** — both are contract-shape decisions, not product polish.
4. Freeze the chunk-hash preimage (**M1**) as a normative spec shared by contract and offchain generator.
5. Measure real Monad gas for a batch transfer → derive `MIN_GAS_PER_TRANSFER` (**C2**) and the default chunk size.
6. *Then* write `Distribution` + `DistributionFactory`, with the fuzz invariants from [CONTRACT_SPEC.md](CONTRACT_SPEC.md) plus: *execution either records true outcomes or reverts*.
