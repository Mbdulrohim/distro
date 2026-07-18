// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { PayloadLib } from "./PayloadLib.sol";

/// @title MultisendNative
/// @notice Distributes native MON to many recipients in a single transaction.
///
/// @dev The native-currency sibling of `Multisend`. Deliberately a SEPARATE
/// contract rather than a new function bolted onto the already-deployed
/// `Multisend` — that contract is live and proven on both networks; this adds
/// a capability without touching working code or its address.
///
/// **Same non-custodial guarantee, harder to get right for native value.**
/// `Multisend` gets "holds nothing" for free: a failed `transferFrom` simply
/// never moves the caller's tokens. Native MON is sent via `msg.value` up
/// front, so a failed recipient's share is already inside this contract's
/// balance — without an explicit refund, it would be stuck. `distribute`
/// therefore refunds every undelivered unit back to the caller in the SAME
/// transaction, so the contract's balance still returns to zero by the time
/// the call ends: the "no custody" property holds, it just takes one more
/// step to prove than the ERC-20 case.
///
///  - **no custody**: any MON not delivered to a recipient is refunded to
///    `msg.sender` before the call returns. Nothing is ever retained here
///    from one transaction to the next.
///  - **no owner, no pause, no fee**: nothing to govern, same as `Multisend`.
///  - **no state**: beyond the reentrancy guard.
contract MultisendNative is ReentrancyGuard {
    using PayloadLib for bytes;

    /// @notice Minimum gas required before attempting a transfer.
    /// @dev A *correctness* control, not a security one — same reasoning as
    /// `Multisend.MIN_GAS_PER_TRANSFER`: this only ever moves the caller's own
    /// value, so there is no griefing vector, only the risk of an under-gassed
    /// call mislabeling a healthy recipient as a rejection. A plain value
    /// transfer to an EOA costs ~2,300-21,000 gas; a contract recipient with a
    /// nontrivial `receive()` can cost meaningfully more. 100k mirrors
    /// `Multisend`'s measured floor and carries comparable headroom.
    uint256 internal constant MIN_GAS_PER_TRANSFER = 100_000;

    /// @notice A recipient was paid.
    event Paid(address indexed recipient, uint256 amount, uint256 index);

    /// @notice A recipient's transfer failed; refunded to the sender with the
    /// rest of the undelivered total.
    /// @dev Isolated per recipient so one reverting recipient (a contract
    /// whose `receive()` reverts, or that has none) cannot block the rest of
    /// the batch. Retry by calling `distribute` again with only the failed
    /// entries.
    event PaymentFailed(address indexed recipient, uint256 amount, uint256 index);

    /// @notice Summary of one distribution. Indexed so a client can find its runs.
    event Distributed(
        address indexed sender, uint256 totalPaid, uint256 paidCount, uint256 failedCount
    );

    /// @notice Refusing to burn MON by sending to the zero address.
    error ZeroRecipient(uint256 index);
    /// @notice Gas limit too low to attempt this transfer honestly. See MIN_GAS_PER_TRANSFER.
    error InsufficientGas(uint256 index);
    /// @notice `msg.value` did not exactly equal the payload's total — reverts
    /// rather than silently over-charging the caller or under-funding
    /// recipients.
    error IncorrectValue();
    /// @notice The end-of-call refund to `msg.sender` reverted. Reverts the
    /// whole distribution rather than stranding MON here — see the
    /// no-custody note above.
    error RefundFailed();

    /// @notice Send native MON to every recipient encoded in `payload`.
    /// @param payload Concatenated 36-byte entries of `abi.encodePacked(address recipient, uint128 amount)`.
    /// @dev `msg.value` must equal the payload's exact total. Any entry that
    /// fails to deliver is refunded, along with any entry never attempted due
    /// to running out, to `msg.sender` before this call returns.
    /// @return totalPaid Sum of amounts successfully delivered.
    /// @return paidCount Number of successful transfers.
    /// @return failedCount Number of failed transfers (refunded to the caller).
    function distribute(bytes calldata payload)
        external
        payable
        nonReentrant
        returns (uint256 totalPaid, uint256 paidCount, uint256 failedCount)
    {
        uint256 count = payload.count();

        uint256 total;
        for (uint256 i; i < count; ++i) {
            (address recipient, uint256 amount) = payload.entryAt(i);
            if (recipient == address(0)) revert ZeroRecipient(i);
            unchecked {
                total += amount;
            }
        }
        // Computed before any transfer is attempted: the caller must fund
        // exactly the payload's total, not more (stray value would otherwise
        // need its own refund path) and not less (a short fund would mean
        // recipients found out mid-batch that later transfers can't happen).
        if (msg.value != total) revert IncorrectValue();

        for (uint256 i; i < count; ++i) {
            (address recipient, uint256 amount) = payload.entryAt(i);
            // Reverts rather than letting an under-gassed call mislabel a
            // healthy recipient as a rejection.
            if (gasleft() < MIN_GAS_PER_TRANSFER) revert InsufficientGas(i);

            (bool ok,) = recipient.call{ value: amount }("");
            if (ok) {
                unchecked {
                    totalPaid += amount;
                    ++paidCount;
                }
                emit Paid(recipient, amount, i);
            } else {
                unchecked {
                    ++failedCount;
                }
                emit PaymentFailed(recipient, amount, i);
            }
        }

        // The no-custody invariant: whatever wasn't delivered goes back to
        // the caller now, in this same transaction, rather than sitting here.
        uint256 leftover = total - totalPaid;
        if (leftover > 0) {
            (bool refunded,) = msg.sender.call{ value: leftover }("");
            if (!refunded) revert RefundFailed();
        }

        emit Distributed(msg.sender, totalPaid, paidCount, failedCount);
    }
}
