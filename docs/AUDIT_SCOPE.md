# Audit scope — Distribution / DistributionFactory

> Prepared for handoff to an external auditor or contest platform (Code4rena, Sherlock, Cantina, or a direct firm engagement). Nothing here has been audited yet — this document exists to make that engagement fast to scope, not to substitute for it. Mainnet deployment is blocked until a real audit completes; see [CLAUDE.md](../CLAUDE.md).

## What's in scope

| File                                    | Purpose                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `contracts/src/Distribution.sol`        | Per-distribution escrow clone. Holds the funds.                             |
| `contracts/src/DistributionFactory.sol` | Deploys clones (EIP-1167), holds protocol config (fee, pause).              |
| `contracts/src/PayloadLib.sol`          | Canonical recipient-payload encoding, shared by commitment/event/execution. |

**Explicitly out of scope**: `contracts/src/Multisend.sol` (stateless, holds nothing, no custody — a materially different risk class already deployed to Monad mainnet at `0xd9C74a4E9FccD971960b76AF204c0c3b7cbe4538` and never wired into the app pending its own audit).

## Why this contract exists, and what it's not

`Distribution`/`DistributionFactory` is the scheduled/escrow half of Distro (a Multisend-only immediate-send path already exists and needs none of this). The core tension it resolves: Distro must let a distribution execute while the creator is offline, but Distro itself must not be a custodian. See [CONTRACT_SPEC.md](CONTRACT_SPEC.md) for the full design rationale and [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) for the adversarial pass that shaped it (three critical findings — C1 fake-permissionless-execution, C2 gas-griefing, C3 stranded-funds — were all found and fixed _before_ this was implemented, not after).

## Core invariants (the property tests below try to prove)

1. **Escrowed balance is exact.** `totalPaid + failedAmount` never exceeds `totalAmount`; the contract's own balance equals `failedAmount` once a chunk has executed (nothing unaccounted for sits in the contract).
2. **No double-payment**, across `executeChunk` + `retry` + a griefed/reverted call, for both the ERC-20 and native-MON paths.
3. **`cancel()`/`reclaim()` cannot be combined to double-refund or double-spend** escrowed funds, and `cancel()` is permanently blocked once `executedCount > 0`.
4. **No admin path to user funds.** The factory owner (a Safe multisig, never an EOA) can pause new creation and set the protocol fee — and _nothing else_. It cannot seize, freeze, redirect, or delay a funded distribution. This is the property the entire "not a custodian" product claim rests on.
5. **A chunk execution either records true outcomes or reverts entirely** — the governing gas-griefing invariant. A permissionless caller must never be able to make healthy recipients look rejected.
6. **Payload commitments can't be replayed** across chunks or across distributions (the hash binds `address(this)` and `chunkIndex`).
7. **No chunk executes before `executeAfter`**, and `schedule()` can't move that goalpost once execution has started.

## What's new since the last review pass (2026-07-19) — look here hardest

Two capabilities were added after the original design was frozen. Both are real, not stubs, and both deserve extra scrutiny precisely because they're newest:

- **Native MON support** (`token == address(0)`). `fund()` becomes payable; every payout, refund, and fee transfer branches between a native `call{value:}` and the existing `SafeERC20` path. **Reentrancy is the specific concern**: verify that `nonReentrant` (a single, contract-wide lock shared across `fund`/`executeChunk`/`retry`/`cancel`/`reclaim`) actually blocks cross-function reentry via a malicious recipient's `receive()`, not just same-function reentry.
- **`schedule()` decoupled from creation.** `executeAfter` is now mutable by the creator until the first chunk executes (same gate as `cancel()`). Verify this can't be raced against an in-flight `executeChunk` call, and that it's genuinely blocked (not just discouraged) once `executedCount > 0`.

## Known, deliberate design tradeoffs — not bugs

An auditor unfamiliar with the product context could flag these as findings. They're documented decisions:

- **Cancellation is always available until execution starts, regardless of `executeAfter`.** A scheduled distribution is _"a promise, not a guarantee"_ (docs/CONTRACT_SPEC.md, O1) — correct for payroll (employers can change plans), explicitly wrong for bounties/grants where credible commitment matters. There is no irrevocable mode in this version.
- **No execution incentive.** `executeChunk`/`retry` are permissionless but unpaid. In practice, the realistic executor is Distro's own keeper or the creator themselves — this is a safety net, not a keeper economy, and product copy must not claim otherwise (O2).
- **Clones are immutable.** A bug found post-launch can be fixed for _new_ distributions (point the factory at a new implementation) but never for distributions already live. This is accepted, not an oversight.
- **No token allowlist.** Fee-on-transfer and rebasing tokens are rejected at `fund()` via a balance-delta check, but nothing curates known-broken tokens more broadly (O4, still open).

## Test coverage as of this document

- 67 tests in `contracts/test/Distribution.t.sol` (98 across the whole `contracts/` suite), covering every public function on both `Distribution` and `DistributionFactory`, including:
  - Full lifecycle (create → commit → fund → execute → complete) for both ERC-20 and native MON.
  - Gas-griefing reverts and non-poisoning (`test_execute_gasGriefingReverts`, `test_native_gasGriefingReverts`, and their `..._griefedChunkIsNotMarkedExecuted` counterparts).
  - Non-standard ERC-20 behavior: no-return (USDT-class), blocklist (USDC-class) — both on the pay-in (`fund`) and pay-out (`executeChunk`) side.
  - Access control: every creator-gated function tested against a stranger caller; factory owner tested to have zero power over a funded distribution's tokens.
  - 4 fuzz tests on the core money invariants (2 ERC-20, 2 native-MON — see "What's new" above).
- **Not yet run**: Slither or another static analyzer. Not available in the environment this document was prepared in — run it (or an equivalent) before or alongside the external audit; it is cheap and complementary, not a substitute.
- **Not yet run**: a formal invariant-testing campaign (Foundry's `invariant` mode, not just `testFuzz`) exercising random sequences of _all_ public functions rather than single fixed sequences. Recommended as a pre-audit step if time allows — it's the highest-leverage way to catch a state-machine hole like the ones ARCHITECTURE_REVIEW.md's C3 already found and fixed once.

## Recommended process

1. Run the existing suite yourself first: `cd contracts && forge test -vvv` (67/67 should pass, ~0.2s).
2. Read `docs/CONTRACT_SPEC.md` and `docs/ARCHITECTURE_REVIEW.md` for intended behavior before reading code for bugs — several "surprising" behaviors above are deliberate.
3. Engage the auditor/contest with this document, the three in-scope files, and the test suite as the baseline.
4. Do not deploy to Monad mainnet until the audit report's findings are resolved and re-reviewed. Testnet deployment carries no such gate (no real value at risk) and can happen at any time independent of this process.
