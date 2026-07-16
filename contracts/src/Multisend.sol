// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Multisend
/// @notice Distributes an ERC-20 token to many recipients in a single transaction.
///
/// @dev Distro's MVP distribution primitive. See docs/CTO_REVIEW.md — the escrow
/// architecture in docs/CONTRACT_SPEC.md exists solely to serve *scheduled*
/// execution. A distribution that runs while the creator is present and signing
/// needs none of it, so this contract deliberately has:
///
///  - **no custody**: tokens move `msg.sender -> recipient` directly, so this
///    contract's balance is always zero. A failed payment simply doesn't happen
///    and the tokens stay with the sender — there is nothing to refund, and
///    nothing here to steal.
///  - **no owner, no pause, no fee**: nothing to govern. Being stateless makes
///    this contract trivially replaceable (deploy a new one, repoint the
///    frontend), which is why a fee hook isn't pre-installed the way it would
///    have to be in a stateful escrow.
///  - **no state**: beyond the reentrancy guard.
///
/// Scheduling lands later as a separate escrow contract reusing this payload
/// encoding — this contract is not modified by that work.
contract Multisend is ReentrancyGuard {
    /// @notice Canonical payload entry: `abi.encodePacked(address, uint128)`.
    /// @dev Normative encoding, shared with the future escrow contract — see
    /// docs/CONTRACT_SPEC.md. `uint128` caps one payment at ~3.4e38 base units;
    /// `uint96` would have overflowed on high-supply tokens.
    uint256 internal constant ENTRY_SIZE = 36;

    /// @notice Minimum gas required before attempting a transfer.
    /// @dev Not a security control here (unlike the escrow, where execution is
    /// permissionless): `distribute` only ever moves the caller's own tokens, so
    /// there is no griefing vector. It is a *correctness* control. Without it, a
    /// caller whose gas limit is too low has every transfer caught and recorded
    /// as `PaymentFailed`, making their own recipients look like they rejected
    /// the payment. This converts that into a clean revert that writes nothing.
    ///
    /// **Placeholder pending measurement on Monad — see test/Multisend.gas.t.sol.**
    /// Locally a transfer's marginal cost is ~28.6k, so 100k carries ~3.5x
    /// headroom. The Monad figure is *not* that number times four: the "3-4x
    /// cold access" penalty applies to cold-access opcodes (~2.1k SLOAD, ~2.6k
    /// account), not to the ~20k SSTORE that dominates crediting a fresh balance.
    /// The real cost is likely ~40-50k, but a constant guarding other people's
    /// payroll should not rest on "likely".
    ///
    /// The floor is not free: Monad charges on `gas_limit` rather than gas used,
    /// so the caller must supply headroom the final transfer never spends. That
    /// is ~1% on a 200-recipient run and ~185% on a single payment — which is
    /// exactly the shape of the "test payment" flow in docs/FEATURES.md. Revisit
    /// once the true figure is known.
    uint256 internal constant MIN_GAS_PER_TRANSFER = 100_000;

    /// @notice A recipient was paid.
    event Paid(address indexed token, address indexed recipient, uint256 amount, uint256 index);

    /// @notice A recipient's transfer failed; the sender keeps these tokens.
    /// @dev Isolated per recipient so one blocklisted address (USDC-class) cannot
    /// revert an entire payroll run. Retry by calling `distribute` again with
    /// only the failed entries.
    event PaymentFailed(
        address indexed token, address indexed recipient, uint256 amount, uint256 index
    );

    /// @notice Summary of one distribution. Indexed so a client can find its runs.
    event Distributed(
        address indexed sender,
        address indexed token,
        uint256 totalPaid,
        uint256 paidCount,
        uint256 failedCount
    );

    /// @notice Payload length is not a whole number of 36-byte entries.
    error InvalidPayloadLength();
    /// @notice Payload contains no entries.
    error EmptyPayload();
    /// @notice Refusing to burn tokens by sending to the zero address.
    error ZeroRecipient(uint256 index);
    /// @notice Gas limit too low to attempt this transfer honestly. See MIN_GAS_PER_TRANSFER.
    error InsufficientGas(uint256 index);
    /// @notice Token address has no code — a typo'd address must not look like a success.
    error TokenNotContract();

    /// @notice Send `token` to every recipient encoded in `payload`, pulling from the caller.
    /// @param token The ERC-20 to distribute. The caller must have approved at
    /// least the payload's total to this contract.
    /// @param payload Concatenated 36-byte entries of `abi.encodePacked(address recipient, uint128 amount)`.
    /// @return totalPaid Sum of amounts successfully delivered.
    /// @return paidCount Number of successful transfers.
    /// @return failedCount Number of failed transfers (their tokens remain with the caller).
    function distribute(IERC20 token, bytes calldata payload)
        external
        nonReentrant
        returns (uint256 totalPaid, uint256 paidCount, uint256 failedCount)
    {
        if (payload.length == 0) revert EmptyPayload();
        if (payload.length % ENTRY_SIZE != 0) revert InvalidPayloadLength();
        // A call to an address with no code returns success with empty returndata,
        // which `_tryTransferFrom` would otherwise read as a successful payment.
        if (address(token).code.length == 0) revert TokenNotContract();

        uint256 count = payload.length / ENTRY_SIZE;

        for (uint256 i; i < count; ++i) {
            (address recipient, uint256 amount) = _decodeEntry(payload, i);

            if (recipient == address(0)) revert ZeroRecipient(i);
            if (gasleft() < MIN_GAS_PER_TRANSFER) revert InsufficientGas(i);

            if (_tryTransferFrom(token, msg.sender, recipient, amount)) {
                unchecked {
                    totalPaid += amount;
                    ++paidCount;
                }
                emit Paid(address(token), recipient, amount, i);
            } else {
                unchecked {
                    ++failedCount;
                }
                emit PaymentFailed(address(token), recipient, amount, i);
            }
        }

        emit Distributed(msg.sender, address(token), totalPaid, paidCount, failedCount);
    }

    /// @dev Reads entry `index` from calldata. Layout: bytes[0:20] recipient, bytes[20:36] amount.
    function _decodeEntry(bytes calldata payload, uint256 index)
        private
        pure
        returns (address recipient, uint256 amount)
    {
        assembly {
            let ptr := add(payload.offset, mul(index, ENTRY_SIZE))
            // Top 20 bytes of the word at ptr.
            recipient := shr(96, calldataload(ptr))
            // Top 16 bytes of the word at ptr+20. Any bytes read beyond this
            // entry are shifted out, so a read past the payload's end is safe.
            amount := shr(128, calldataload(add(ptr, 20)))
        }
    }

    /// @dev `transferFrom` that reports failure instead of reverting, tolerating
    /// non-standard ERC-20s. Handles: reverting tokens, tokens returning `false`,
    /// and tokens returning nothing at all (USDT-class) — the latter would break
    /// a plain `IERC20.transferFrom` call, whose ABI decode of an empty return
    /// would revert and make every USDT payment look like a rejection.
    ///
    /// Uses a low-level call rather than try/catch + SafeERC20: try/catch needs an
    /// external call, which would mean exposing a self-callable transfer helper —
    /// an function that, if its caller guard were ever wrong, would drain every
    /// wallet that had approved this contract. This avoids that surface entirely.
    function _tryTransferFrom(IERC20 token, address from, address to, uint256 amount)
        private
        returns (bool)
    {
        (bool ok, bytes memory ret) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, to, amount)));

        if (!ok) return false;
        if (ret.length == 0) return true; // Non-standard: no return value means success.
        if (ret.length == 32) return abi.decode(ret, (bool));
        return false; // Unexpected return shape — do not guess.
    }
}
