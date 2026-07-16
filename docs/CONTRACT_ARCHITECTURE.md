# Smart Contract System — Architecture

System-level design of Distro's contracts, organized by concern. Architecture only — no Solidity. For the escrow's normative detail see [CONTRACT_SPEC.md](CONTRACT_SPEC.md); for the built MVP see `contracts/src/Multisend.sol`.

The system has **two contracts, shipped in sequence**, sharing one payload encoding:

- **`Multisend`** — stateless, synchronous. Execution happens now, while the sender signs. *Built.*
- **`DistributionFactory` + `Distribution`** — stateful escrow, asynchronous. Execution happens on a schedule, while the sender is offline. *Designed, not built.*

Why two and not one: escrow's entire cost (custody, state machine, keeper, onchain data availability) exists only to let a run fire while the creator is offline. A synchronous run needs none of it. Forcing the MVP through escrow would pay escrow's full price for a feature the MVP doesn't use. See [CTO_REVIEW.md](CTO_REVIEW.md) S1.

---

## 1. Contract responsibilities

Single responsibility per contract; nothing owns more than it must.

| Contract | Owns | Explicitly does *not* own |
|---|---|---|
| **`Multisend`** | Decode a payload, pull-and-push each transfer from the caller, isolate per-recipient failure, emit results. | Custody, scheduling, state, access control, fees, upgradeability. |
| **`DistributionFactory`** | Deploy `Distribution` clones deterministically; hold protocol config (fee bps, treasury, pause-new-creation); enumerate a creator's distributions. | Any power over funds already inside a deployed `Distribution`. |
| **`Distribution`** (clone) | Escrow one distribution's funds; commit + emit the recipient list; enforce the schedule; execute permissionlessly; isolate failures; handle cancel/reclaim. | Cross-distribution state, admin override, mutability. |

**The load-bearing boundary:** the factory can configure the *system* (fees, pausing new creation) but has **no path to funds in a live `Distribution`**. Isolation is per-distribution — a bug or exploit in one clone cannot reach another's escrow, and the factory owner cannot seize or redirect a funded run. This is provable in tests, not just asserted.

---

## 2. Storage design

### `Multisend` — no persistent storage

Beyond the inherited reentrancy-guard slot, `Multisend` stores **nothing**. Recipients and amounts arrive in calldata, are acted on, and are gone. This is the property that removes the entire class of storage-related bugs and makes the contract trivially replaceable.

The contract's **token balance is always zero** by construction (funds move `sender → recipient` directly, never through the contract), so there is no balance to track, strand, or reconcile.

### `Distribution` — minimal, commitment-based

The escrow's storage is deliberately shaped so the expensive data (the recipient list) lives in **event logs, not storage**:

| Stored onchain (storage) | Held in calldata / logs (not storage) |
|---|---|
| `token`, `creator`, `executeAfter` | recipient addresses |
| `totalAmount`, `totalPaid`, `failedAmount` | per-recipient amounts |
| `chunkCount`, `committedCount`, `executedCount` | the payloads themselves (emitted, reconstructable from logs) |
| `chunkHashes[]` (one hash per chunk) | |
| `chunkExecuted` bitmap, `failed[(chunk, position)]` map | |
| `state`, `reclaimed` flag | |

**Why commitment, not storage, for the list:** storing a recipient entry costs ~20k gas; a 1,000-person payroll would cost ~20M gas just to *store*, before paying anyone. Instead the contract stores a per-chunk **hash** and emits the full payload as event data (~8 gas/byte). Anyone can rebuild any chunk from logs.

**Why this is correctness-critical, not just cheap:** if the list lived only in Distro's database, only Distro could execute — silently reintroducing the liveness dependency escrow exists to remove. Emitting it onchain is what makes permissionless execution *real*. See [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) C1.

**Why the contract sums amounts itself:** because it receives the real payload at commit time, it computes `totalAmount` from the committed entries rather than trusting a creator-supplied figure — the "escrow doesn't cover the payments" failure mode cannot occur.

### Shared payload encoding (normative)

One format, used identically for the MVP, the escrow commitment, the emitted event, and execution calldata — so the two contracts share machinery and offchain generation can never drift from onchain verification:

```
entry   = address recipient (20 bytes) ‖ uint128 amount (16 bytes)   // 36 bytes, packed
payload = entry ‖ entry ‖ …
```

`uint128` caps one payment at ~3.4e38 base units — ample for high-supply tokens, where `uint96` would overflow. The chunk hash binds the distribution and index (`hash(address(this), chunkIndex, payload)`) so a payload can never be replayed against a different chunk or contract.

---

## 3. Events

Events are the system's read model — the dashboard and (later) the indexer are built entirely on them, and for the MVP they *are* the datastore.

| Event | Emitted by | Purpose |
|---|---|---|
| `Paid(token, recipient, amount, index)` | both | one successful transfer |
| `PaymentFailed(token, recipient, amount, index)` | both | one isolated failure (sender keeps the funds) |
| `Distributed(sender, token, totalPaid, paidCount, failedCount)` | `Multisend` | one run's summary |
| `RecipientsCommitted(chunkIndex, payload)` | `Distribution` | **the data-availability guarantee** — the full list, onchain |
| `DistributionCreated(distribution, creator, token, executeAfter, chunkCount)` | factory | indexer entry point |
| `Funded` / `ChunkExecuted` / `Cancelled` / `Reclaimed` | `Distribution` | state-machine transitions |

**Design decisions:**
- **The MVP needs no indexer** because the execution transaction's own receipt contains every `Paid`/`PaymentFailed` — parsed client-side. This is the single biggest operational simplification in the whole system.
- Recipient and token are **indexed topics** so a client can filter "everything paid to address X" or "every run of token Y" without scanning.
- `index` (and, in escrow, `position`) is on every payment event so a result maps back to its exact row — and is the retry key, never the address.

---

## 4. Functions (interface level)

### `Multisend`

- `distribute(token, payload) → (totalPaid, paidCount, failedCount)` — the entire public surface. Reentrancy-guarded. Pulls from `msg.sender`, pushes to each recipient, isolates failures, emits. Returns a summary the caller can use synchronously.

One function. No admin functions, no owner, no configuration — there is nothing to govern.

### `DistributionFactory`

- `createDistribution(token, executeAfter, chunkCount, salt) → address` — deploys a clone at a deterministic address; reverts on duplicate `(creator, salt)` (the double-funding guard).
- `setFee(bps, treasury)` / `setPaused(bool)` — owner (multisig) only; affect **new** distributions only.
- `distributionsOf(creator) → address[]` — enumeration.

### `Distribution`

- `commitChunk(chunkIndex, payload)` — creator; hashes, sums, emits the list; → `Ready` when all chunks committed.
- `fund()` — anyone; pulls `totalAmount` + fee; balance-delta check rejects fee-on-transfer/rebasing tokens; → `Funded`. **Decoupled from creation**, so the creator chooses the lock-up window.
- `executeChunk(chunkIndex, payload)` — **anyone**; enforces `executeAfter`, verifies the payload hash, gas-floors each transfer, isolates failures.
- `retry(chunkIndex, payload, positions)` — anyone; re-attempts failures, keyed by `(chunkIndex, position)`.
- `cancel()` — creator; allowed only while no chunk has executed; full refund.
- `reclaim()` — creator; sweeps undeliverable/unexecuted funds after completion or grace period.

**Why `fund` and `executeChunk` are permissionless:** funding may come from a treasury multisig that isn't the creator; execution *must* be callable by anyone or the "survives Distro's downtime" guarantee is a lie.

---

## 5. Execution flow

### MVP (synchronous)

```
sender: approve(Multisend, total)          ← standard ERC-20 allowance
sender: distribute(token, payload)
          ├─ validate payload (length, non-empty, token has code)
          └─ for each entry:
               ├─ gas floor check  → revert if too low (correctness guard)
               ├─ transferFrom(sender → recipient)
               │     success → Paid,  totalPaid += amount
               │     failure → PaymentFailed (funds stay with sender)
          └─ Distributed(summary)
receipt: client parses Paid/PaymentFailed  ← no indexer needed
```

One transaction (plus the approve). The sender is present throughout; results are known the moment the receipt returns.

### Escrow (asynchronous)

```
Draft ──commitChunk × N──▶ Ready ──fund()──▶ Funded ──[executeAfter reached]──▶ executeChunk × N ──▶ Completed
  │                          │                  │                                                       │
  └─────── cancel() ─────────┴──────────────────┘  (only while no chunk executed)                       │
                                                                                          reclaim() ◀────┘
```

Creation, funding, and execution are **three separate moments**, possibly days apart, possibly different callers. The schedule is enforced onchain (`executeAfter`), not by Distro. Full state semantics in [CONTRACT_SPEC.md](CONTRACT_SPEC.md).

---

## 6. Gas optimization

Monad charges on **`gas_limit`, not gas used**, so over-provisioning is a real cost to the caller — optimization here is about honesty as much as efficiency.

| Technique | Where | Effect |
|---|---|---|
| **Calldata + events instead of storage for the list** | escrow | ~20k → ~8 gas/byte per entry; the single biggest saving |
| **Packed 36-byte payload** (`address‖uint128`) | both | minimal calldata per recipient |
| **Assembly calldata decode** | both | avoids ABI-decode overhead in the hot loop |
| **`unchecked` accumulators** | both | counters/sums that provably can't overflow |
| **Minimal-proxy clones (EIP-1167)** | escrow | per-distribution isolation at a fraction of full-deploy gas |
| **Bitmap for chunk-executed flags** | escrow | one slot covers 256 chunks |
| **Chunked execution** | both | keeps any single tx under block gas limits; chunk size derived from measured Monad gas |

**The open item:** `MIN_GAS_PER_TRANSFER` must be *measured* on Monad, not extrapolated. Local marginal cost is ~28.6k/transfer; the naive "×4 for Monad cold access" is invalid because that penalty applies to cold-access opcodes, not the ~20k SSTORE that dominates a fresh-balance credit. Too high a floor taxes every run (that gas is paid, not refunded); too low starves real transfers. Blocks mainnet. See `contracts/test/Multisend.gas.t.sol`.

---

## 7. Security

| Property | Mechanism |
|---|---|
| **No custody (MVP)** | direct `sender → recipient` transfers; contract balance provably always zero — nothing to drain. |
| **No admin over funds** | `Multisend` has no owner; the factory can never touch a funded `Distribution`. |
| **Reentrancy** | guard on every state-touching external function; checks-effects-interactions (chunk marked executed before transferring). |
| **Malicious/non-standard tokens** | low-level `call` + manual return decode tolerates no-return (USDT-class), `false`-return, and garbage-return tokens; fee-on-transfer/rebasing rejected at funding via balance-delta; ERC-777/callback tokens excluded (callback reentrancy vector). |
| **No self-callable transfer helper** | using a low-level call instead of try/catch avoids exposing an external transfer function that, if its guard were ever wrong, would drain every wallet that approved the contract. |
| **False-failure griefing** | gas floor per transfer. In escrow this is a *security* control (execution is permissionless — an attacker could otherwise mark a whole payroll "failed" with one cheap tx); in the MVP it's a *correctness* control (only the caller's own tokens move, so no griefing vector, but a low gas limit could still mislabel results). |
| **Replay / cross-contract confusion** | chunk hash binds `address(this)` and `chunkIndex`; CREATE2 `(creator, salt)` guards double-funding. |
| **Privileged ops** | factory owner is a Safe multisig from day one, testnet included; pause affects only new-creation and emits loudly. |

**Verification plan:** Foundry unit + fuzz + invariant suites; Slither in CI; external audit before mainnet. Governing invariant for escrow: *a chunk execution either records true outcomes or reverts entirely.*

---

## 8. Upgrade strategy

**Deliberately immutable. No proxies, no upgradeability, anywhere.**

| Contract | Strategy | Why |
|---|---|---|
| `Multisend` | Redeploy + repoint frontend | Stateless and holds no funds, so replacement is free — no migration, no state to carry. A new version is a new address; the old one keeps working for anyone still pointed at it. |
| `Distribution` clones | Immutable forever | They hold user funds. An upgradeable escrow means an admin key that *can* change the rules under which funds are held — the exact custody risk the product disclaims. |
| `DistributionFactory` | Non-upgradeable; points *new* clones at a new implementation | The factory can adopt a fixed implementation for future distributions, but **live distributions are frozen**. |

**The explicit trade this makes:** a bug found post-launch **cannot be patched for in-flight distributions** — only for new ones. This is stated as a product promise, not hidden. Immutability is chosen over upgradeability because for a fund-holding contract, an upgrade key is itself the largest attack surface, and "no one can change the rules after you fund" is a stronger guarantee than "we can fix bugs." Mitigations live *before* deployment (audit, testnet bake-in, size caps), not after.

---

## 9. Edge cases

| Case | Handling |
|---|---|
| Duplicate recipient in one distribution | Legal by design (pay someone twice intentionally); validation warns; retry keyed by position, not address, so the same address failing in two chunks is tracked independently. |
| Recipient is a contract that reverts on receipt | Isolated failure; funds stay with sender/escrow; message distinguishes "recipient rejected" from "Distro failed." |
| Token pauses between funding and execution (escrow) | Every transfer fails; run looks broken but isn't — retry-later + reclaim recover it; UI must attribute it to the token. |
| `executeAfter` in the past at creation | Legal — equals "execute now." |
| Zero-amount entry | Rejected at import (wasteful no-op). |
| Zero-address recipient | Reverts the whole call — refusing to burn funds. |
| Creator's balance drops below total between commit and fund | `fund()` reverts cleanly; dashboard should catch it first. |
| Last entry's amount read past calldata end | Assembly decode shifts out-of-range bytes to zero — tested explicitly. |
| Nobody ever executes a funded distribution (escrow) | Post-grace `reclaim()` — the escape hatch that prevents permanent fund stranding. |
| Distribution too large to commit in one tx | Multi-tx commit; a defined ceiling with a clear error, not a wallet failure at tx 47 of 60. |

---

## 10. Failure handling

The philosophy: **isolate what should be isolated, revert what should be atomic, never lie about either.**

- **Per-recipient failures are isolated, not fatal.** One blocklisted address (USDC-class) must never revert a payroll for everyone else. Failed entries are recorded and emitted; their funds stay with the sender (MVP) or in escrow for retry (escrow). *"Retry failed transfers"* is in the PRD's problem statement — this is core behavior, not an edge case.
- **Retry is not a special mechanism.** MVP: a second `distribute` with the failed subset. Escrow: `retry` with the failed positions. Already-paid recipients are never paid twice.
- **Structural failures are atomic.** A ragged payload, an empty payload, a zero recipient, a non-contract token, or insufficient gas reverts the *entire* call and writes nothing — a half-applied structural error is worse than none.
- **The system never records a false outcome.** The gas floor exists precisely so "recorded as failed" always means "genuinely failed," never "the executor under-provisioned gas." This is the difference between a trustworthy result set and a misleading one.
- **Undeliverable funds are always recoverable** (escrow): `reclaim` sweeps what couldn't be delivered; nothing is ever permanently stuck, and no admin is needed to unstick it.

---

## Open architectural decisions

Tracked in [ROADMAP.md](ROADMAP.md) / [CONTRACT_SPEC.md](CONTRACT_SPEC.md); they change contract shape, so they precede escrow implementation:

- **Measure `MIN_GAS_PER_TRANSFER` on Monad** — blocks MVP mainnet.
- **O1 — irrevocable mode** (waive cancel for credible commitment; can't retrofit into an immutable clone).
- **O2 — execution incentive** (a gas tip from escrow is what makes third-party execution actually happen, vs. "creator self-serves").
- **O3 — recurring shape** (one contract with N tranches vs. N distributions from a template — decides whether v1 escrow reserves cycle state).
- **Monetization basis** (per-recipient vs per-distribution vs volume changes where the fee hook lives).
