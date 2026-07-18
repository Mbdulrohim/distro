// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { PayloadLib } from "./PayloadLib.sol";

/// @title Distribution
/// @notice One scheduled distribution, escrowed. Deployed as an immutable clone
/// by `DistributionFactory`.
///
/// @dev **Why this exists at all.** `Multisend` covers everything except one
/// thing: a run that fires while the creator is offline. That single
/// requirement forces custody, and custody forces all of this. See
/// docs/CONTRACT_SPEC.md.
///
/// **The custody tension, and how it's resolved.** Distro must be a payroll
/// engine but explicitly not a custodian. So: the creator escrows funds here,
/// and at `executeAfter` **anyone** may trigger execution. The contract can
/// only ever pay the committed recipients or refund the creator — nobody,
/// including Distro and the factory owner, can redirect a single token. Distro
/// runs a keeper for convenience; if it vanishes, the creator or any third
/// party can still execute.
///
/// **Data availability is what makes that true.** `commitChunk` emits the full
/// recipient payload as event data (~8 gas/byte vs ~20k per storage slot).
/// Committing only a hash would leave the list solely in Distro's database —
/// meaning nobody else could execute, silently reintroducing the exact
/// dependency escrow exists to remove. See ARCHITECTURE_REVIEW.md C1.
///
/// **Decided (2026-07-16), and baked in permanently:**
/// - **Always cancellable** while no chunk has executed — gated on execution
///   progress, not on `executeAfter`, which is what closes the stranded-funds
///   hole (C3). Consequence: a scheduled distribution is a *promise, not a
///   guarantee*; recipients cannot rely on it. Correct for payroll, wrong for
///   bounties. There is no irrevocable mode.
/// - **No execution incentive.** Execution is permissionless but unpaid, so
///   absent Distro's keeper the realistic executor is the creator. That is a
///   safety net, not a keeper ecosystem — do not claim otherwise.
///
/// **Decided (2026-07-19): native MON.** `token == address(0)` means this
/// distribution escrows native MON instead of an ERC-20 — `fund()` takes
/// `msg.value` instead of pulling, and every payout/refund is a native
/// `call{value:}` instead of an ERC-20 transfer. One contract, one code path
/// per branch, rather than a second contract: the state machine, scheduling,
/// cancellation and reclaim rules are identical either way, and duplicating
/// them would be exactly the kind of drift PayloadLib's single-encoding
/// rationale exists to prevent elsewhere in this system.
///
/// **Decided (2026-07-19): `schedule()` is its own step.** `executeAfter` used
/// to be fixed at creation. It is now mutable — by the creator, any time
/// before the first chunk executes, same gate as `cancel()` — so "create a
/// distribution" and "decide when it runs" are independent actions, matching
/// how the product's create flow actually walks a user through this.
contract Distribution is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PayloadLib for bytes;

    /// @notice Sentinel for `token` meaning "native MON", never a real ERC-20.
    address internal constant NATIVE = address(0);

    /// @notice The only address allowed to call `initialize`.
    /// @dev Set once, in the constructor of the IMPLEMENTATION contract — an
    /// immutable is embedded directly into the bytecode every clone executes
    /// via `delegatecall`, so this is readable (and enforceable) from every
    /// clone despite each clone having its own, otherwise-empty storage.
    ///
    /// Not currently exploitable without this check: `DistributionFactory`
    /// deploys a clone and calls `initialize` on it atomically, in the same
    /// transaction, so no third party ever observes an uninitialized clone to
    /// race. This check exists anyway, because that safety currently rests
    /// entirely on "nothing else ever deploys a clone without immediately
    /// initializing it" — true today, but not a property this contract
    /// itself enforces without this line. Cheap insurance against that
    /// invariant ever being violated by a future change.
    address public immutable expectedFactory;

    constructor(address expectedFactory_) {
        expectedFactory = expectedFactory_;
    }

    enum State {
        Uninitialized,
        Draft,
        Ready,
        Funded,
        Executing,
        Completed,
        Cancelled
    }

    /// @notice Minimum gas before attempting a transfer.
    /// @dev **A security control here**, unlike in `Multisend`. Execution is
    /// permissionless, so without this an attacker calls `executeChunk` with
    /// just enough gas to pass the hash check and enter the loop but not
    /// complete the transfers: every one is caught, recorded as failed, and the
    /// chunk marks itself executed. One cheap transaction poisons a payroll
    /// run. The floor turns that into a revert that writes nothing.
    ///
    /// 100,000 — measured on a Monad mainnet fork (test/Multisend.fork.t.sol):
    /// real USDC costs 31,471 gas/recipient, so this carries ~3.2x headroom.
    /// Do not extrapolate this number from local runs; Monad measured at ~1.1x
    /// local, not the ~4x its "cold access" figure implies.
    uint256 internal constant MIN_GAS_PER_TRANSFER = 100_000;

    /// @notice How long after `executeAfter` before the creator may reclaim
    /// funds nobody executed.
    /// @dev The escape hatch for "funded, scheduled, and nobody ever ran it" —
    /// without it those funds are stranded forever, since there is deliberately
    /// no admin path to them. Long enough that it cannot front-run a keeper
    /// that is merely late.
    uint256 public constant RECLAIM_GRACE_PERIOD = 7 days;

    address public creator;
    /// @dev `address`, not `IERC20` — must be able to hold `NATIVE` (address(0)),
    /// which is not a contract. Cast to `IERC20(token)` at each ERC-20 call site.
    address public token;
    address public factory;
    uint64 public executeAfter;
    uint32 public chunkCount;
    uint32 public committedCount;
    uint32 public executedCount;

    /// @dev Captured at creation, NOT read from the factory at fund time — the
    /// fee a creator agreed to cannot be changed under them afterwards.
    uint16 public feeBps;
    address public treasury;

    /// @notice Sum of committed amounts. Computed by this contract from the real
    /// payloads, never supplied by the caller — so "escrow doesn't cover the
    /// payments" cannot happen (ARCHITECTURE_REVIEW H1).
    uint256 public totalAmount;
    uint256 public totalPaid;
    /// @notice Value of transfers that failed and are retryable.
    uint256 public failedAmount;

    State public state;
    bool public reclaimed;

    mapping(uint256 chunkIndex => bytes32) public chunkHashes;
    mapping(uint256 chunkIndex => bool) public chunkExecuted;
    /// @dev Keyed by position, never by address: duplicate recipients are legal,
    /// so an address is not a unique key (ARCHITECTURE_REVIEW M2).
    mapping(uint256 chunkIndex => mapping(uint256 position => bool)) public failed;

    event RecipientsCommitted(uint256 indexed chunkIndex, bytes payload);
    event DistributionScheduled(uint64 executeAfter);
    event Funded(address indexed funder, uint256 amount, uint256 fee);
    event ChunkExecuted(uint256 indexed chunkIndex, address indexed executor);
    event Paid(address indexed recipient, uint256 amount, uint256 chunkIndex, uint256 position);
    event PaymentFailed(
        address indexed recipient, uint256 amount, uint256 chunkIndex, uint256 position
    );
    event Cancelled(uint256 refunded);
    event Reclaimed(uint256 amount);

    error AlreadyInitialized();
    error NotFactory();
    error NotCreator();
    error WrongState();
    error ChunkOutOfRange();
    error ChunkAlreadyCommitted();
    error ChunkAlreadyExecuted();
    error ChunkNotExecuted();
    error PayloadMismatch();
    error ZeroRecipient(uint256 position);
    error ZeroAmount(uint256 position);
    error TooEarly();
    error InsufficientGas(uint256 position);
    error UnsupportedToken();
    error NotFailed(uint256 position);
    error AlreadyReclaimed();
    error NothingToReclaim();
    /// @notice `fund()` was sent the wrong `msg.value` for this distribution's token.
    error IncorrectValue();
    /// @notice A native-MON send to `treasury`/`creator` reverted.
    error NativeTransferFailed();

    /// @notice Initialize a clone. Callable once, by the factory.
    /// @dev Clones have no constructor, hence this. `state` doubles as the
    /// init guard: a fresh clone's storage is zero (`Uninitialized`).
    function initialize(
        address creator_,
        address token_,
        uint64 executeAfter_,
        uint32 chunkCount_,
        uint16 feeBps_,
        address treasury_
    ) external {
        if (state != State.Uninitialized) revert AlreadyInitialized();
        if (msg.sender != expectedFactory) revert NotFactory();
        creator = creator_;
        token = token_;
        factory = msg.sender;
        executeAfter = executeAfter_;
        chunkCount = chunkCount_;
        feeBps = feeBps_;
        treasury = treasury_;
        state = State.Draft;
    }

    /// @notice Set (or change) when this distribution becomes executable.
    /// @dev Decoupled from creation: `createDistribution` no longer has to
    /// know the schedule. `0` means "no restriction — executable immediately",
    /// which is also what a freshly created distribution defaults to unless
    /// this is called. Same gate as `cancel()` (creator only, before any chunk
    /// has executed) — once execution has begun, the schedule that got you
    /// there is no longer something you get to move.
    function schedule(uint64 executeAfter_) external {
        if (msg.sender != creator) revert NotCreator();
        if (state == State.Cancelled || state == State.Completed) revert WrongState();
        if (executedCount != 0) revert WrongState();

        executeAfter = executeAfter_;
        emit DistributionScheduled(executeAfter_);
    }

    /// @notice Commit one chunk's recipients, emitting them onchain.
    function commitChunk(uint256 chunkIndex, bytes calldata payload) external {
        if (msg.sender != creator) revert NotCreator();
        if (state != State.Draft) revert WrongState();
        if (chunkIndex >= chunkCount) revert ChunkOutOfRange();
        if (chunkHashes[chunkIndex] != bytes32(0)) revert ChunkAlreadyCommitted();

        uint256 n = payload.count();
        uint256 sum;
        for (uint256 i; i < n; ++i) {
            (address recipient, uint256 amount) = payload.entryAt(i);
            if (recipient == address(0)) revert ZeroRecipient(i);
            if (amount == 0) revert ZeroAmount(i);
            unchecked {
                sum += amount;
            }
        }

        chunkHashes[chunkIndex] = PayloadLib.commitmentHash(address(this), chunkIndex, payload);
        totalAmount += sum;
        unchecked {
            ++committedCount;
        }

        // The data-availability guarantee: anyone can rebuild this chunk from
        // logs and execute it, forever.
        emit RecipientsCommitted(chunkIndex, payload);

        if (committedCount == chunkCount) state = State.Ready;
    }

    /// @notice Escrow the funds. Permissionless — a treasury multisig may fund a
    /// distribution it did not create — and decoupled from creation, so the
    /// creator chooses their own lock-up window (ARCHITECTURE_REVIEW H3).
    /// @dev `payable` unconditionally: an ERC-20 funding call must carry zero
    /// `msg.value` (checked below), so this never silently accepts stray MON
    /// alongside an ERC-20 pull.
    function fund() external payable nonReentrant {
        if (state != State.Ready) revert WrongState();

        uint256 fee = (totalAmount * feeBps) / 10_000;
        uint256 required = totalAmount + fee;

        if (token == NATIVE) {
            // The whole point of native funding: msg.value IS the escrow, so
            // there is no before/after balance dance and no fee-on-transfer
            // risk to guard against — it either arrives exactly or the call
            // itself reverts.
            if (msg.value != required) revert IncorrectValue();
        } else {
            if (msg.value != 0) revert IncorrectValue();
            uint256 before = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransferFrom(msg.sender, address(this), required);
            // Rejects fee-on-transfer and rebasing tokens outright. The
            // alternative is silently shorting whoever sorts last.
            if (IERC20(token).balanceOf(address(this)) - before != required) {
                revert UnsupportedToken();
            }
        }

        state = State.Funded;
        if (fee > 0) _sendOut(treasury, fee);

        emit Funded(msg.sender, totalAmount, fee);
    }

    /// @notice Execute a chunk. **Callable by anyone** — that is the point.
    function executeChunk(uint256 chunkIndex, bytes calldata payload) external nonReentrant {
        if (state != State.Funded && state != State.Executing) revert WrongState();
        if (block.timestamp < executeAfter) revert TooEarly();
        if (chunkIndex >= chunkCount) revert ChunkOutOfRange();
        if (chunkExecuted[chunkIndex]) revert ChunkAlreadyExecuted();
        if (
            PayloadLib.commitmentHash(address(this), chunkIndex, payload) != chunkHashes[chunkIndex]
        ) {
            revert PayloadMismatch();
        }

        // Effects before interactions.
        chunkExecuted[chunkIndex] = true;
        unchecked {
            ++executedCount;
        }
        state = State.Executing;

        uint256 n = payload.count();
        for (uint256 i; i < n; ++i) {
            (address recipient, uint256 amount) = payload.entryAt(i);
            // Reverts rather than letting an under-gassed call mislabel a
            // healthy recipient as a rejection.
            if (gasleft() < MIN_GAS_PER_TRANSFER) revert InsufficientGas(i);

            if (_tryTransfer(recipient, amount)) {
                unchecked {
                    totalPaid += amount;
                }
                emit Paid(recipient, amount, chunkIndex, i);
            } else {
                failed[chunkIndex][i] = true;
                unchecked {
                    failedAmount += amount;
                }
                emit PaymentFailed(recipient, amount, chunkIndex, i);
            }
        }

        if (executedCount == chunkCount) state = State.Completed;
        emit ChunkExecuted(chunkIndex, msg.sender);
    }

    /// @notice Re-attempt failed payments. Permissionless; funds can only reach
    /// the originally committed recipients.
    function retry(uint256 chunkIndex, bytes calldata payload, uint256[] calldata positions)
        external
        nonReentrant
    {
        if (state != State.Executing && state != State.Completed) revert WrongState();
        if (!chunkExecuted[chunkIndex]) revert ChunkNotExecuted();
        if (
            PayloadLib.commitmentHash(address(this), chunkIndex, payload) != chunkHashes[chunkIndex]
        ) {
            revert PayloadMismatch();
        }

        uint256 len = positions.length;
        for (uint256 j; j < len; ++j) {
            uint256 pos = positions[j];
            // Guarantees no double-pay: a position is only retryable while
            // flagged failed, and the flag clears on success.
            if (!failed[chunkIndex][pos]) revert NotFailed(pos);

            (address recipient, uint256 amount) = payload.entryAt(pos);
            if (gasleft() < MIN_GAS_PER_TRANSFER) revert InsufficientGas(pos);

            if (_tryTransfer(recipient, amount)) {
                failed[chunkIndex][pos] = false;
                unchecked {
                    failedAmount -= amount;
                    totalPaid += amount;
                }
                emit Paid(recipient, amount, chunkIndex, pos);
            } else {
                emit PaymentFailed(recipient, amount, chunkIndex, pos);
            }
        }
    }

    /// @notice Creator cancels and takes a full refund.
    /// @dev Gated on execution progress, **not** on `executeAfter` (O1 / C3).
    /// Time-gating it would strand funds whenever a scheduled run was never
    /// executed: cancel barred, reclaim unreachable, no admin path. This is
    /// also strictly more useful — calling off Friday's payroll on Friday
    /// morning is legitimate, and it is the creator's money.
    function cancel() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (state != State.Ready && state != State.Funded) revert WrongState();
        if (executedCount != 0) revert WrongState();

        state = State.Cancelled;
        uint256 balance = _selfBalance();
        if (balance > 0) _sendOut(creator, balance);

        emit Cancelled(balance);
    }

    /// @notice Sweep what could not be delivered back to the creator.
    /// @dev Two cases: a completed run with failed payments, and the escape
    /// hatch — funded, past `executeAfter + RECLAIM_GRACE_PERIOD`, and nobody
    /// ever executed. Without the second, those funds are stranded forever.
    function reclaim() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (reclaimed) revert AlreadyReclaimed();

        bool completed = state == State.Completed;
        bool stranded = block.timestamp > uint256(executeAfter) + RECLAIM_GRACE_PERIOD
            && (state == State.Funded || state == State.Executing);
        if (!completed && !stranded) revert WrongState();

        uint256 balance = _selfBalance();
        if (balance == 0) revert NothingToReclaim();

        reclaimed = true;
        // Blocks any further execution — the funds are gone.
        state = State.Completed;
        _sendOut(creator, balance);

        emit Reclaimed(balance);
    }

    /// @dev `transfer` that reports failure instead of reverting, tolerating
    /// non-standard ERC-20s: reverting tokens, `false`-returning tokens, and
    /// USDT-class tokens that return nothing (a plain `IERC20.transfer` would
    /// revert decoding the empty return and mark every payment failed).
    ///
    /// A low-level call rather than try/catch + SafeERC20: try/catch needs an
    /// external call, which would mean exposing a self-callable transfer helper
    /// — a function that, if its caller guard were ever wrong, drains the whole
    /// escrow. This avoids that surface entirely.
    ///
    /// For native MON (`token == NATIVE`), "the transfer" is a plain value
    /// call with empty calldata — same tolerant, non-reverting shape: a
    /// recipient whose `receive()`/`fallback()` reverts is isolated exactly
    /// like a blocklisted ERC-20 recipient, not allowed to poison the batch.
    function _tryTransfer(address to, uint256 amount) private returns (bool) {
        if (token == NATIVE) {
            (bool sent,) = to.call{ value: amount }("");
            return sent;
        }
        (bool ok, bytes memory ret) = token.call(abi.encodeCall(IERC20.transfer, (to, amount)));
        if (!ok) return false;
        if (ret.length == 0) return true;
        if (ret.length == 32) return abi.decode(ret, (bool));
        return false;
    }

    /// @dev This contract's stake in the distribution's token — native balance
    /// or ERC-20 balance, whichever `token` names.
    function _selfBalance() private view returns (uint256) {
        return token == NATIVE ? address(this).balance : IERC20(token).balanceOf(address(this));
    }

    /// @dev An unconditional send — reverts on failure, unlike `_tryTransfer`.
    /// Used only for moves to `treasury`/`creator` (fee, cancel refund,
    /// reclaim refund): those are whole-balance moves where a silent failure
    /// would strand funds with no isolation benefit to gain, unlike a single
    /// recipient among many in `executeChunk`/`retry`.
    function _sendOut(address to, uint256 amount) private {
        if (token == NATIVE) {
            (bool ok,) = to.call{ value: amount }("");
            if (!ok) revert NativeTransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
