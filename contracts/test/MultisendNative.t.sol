// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { MultisendNative } from "../src/MultisendNative.sol";
import { PayloadLib } from "../src/PayloadLib.sol";
import { RevertingReceiver, GasBurnerReceiver, RefundRejecter } from "./mocks/MockTokens.sol";

contract MultisendNativeTest is Test {
    MultisendNative internal multisend;

    address internal sender = makeAddr("sender");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    event Paid(address indexed recipient, uint256 amount, uint256 index);
    event PaymentFailed(address indexed recipient, uint256 amount, uint256 index);
    event Distributed(
        address indexed sender, uint256 totalPaid, uint256 paidCount, uint256 failedCount
    );

    function setUp() public {
        multisend = new MultisendNative();
        vm.deal(sender, 1_000_000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    function _entry(address recipient, uint128 amount) internal pure returns (bytes memory) {
        return abi.encodePacked(recipient, amount);
    }

    function _payload3() internal view returns (bytes memory) {
        return bytes.concat(_entry(alice, 1 ether), _entry(bob, 2 ether), _entry(carol, 3 ether));
    }

    /*//////////////////////////////////////////////////////////////
                              HAPPY PATH
    //////////////////////////////////////////////////////////////*/

    function test_distribute_paysEveryRecipient() public {
        vm.prank(sender);
        multisend.distribute{ value: 6 ether }(_payload3());

        assertEq(alice.balance, 1 ether);
        assertEq(bob.balance, 2 ether);
        assertEq(carol.balance, 3 ether);
    }

    function test_distribute_returnsCorrectSummary() public {
        vm.prank(sender);
        (uint256 totalPaid, uint256 paidCount, uint256 failedCount) =
            multisend.distribute{ value: 6 ether }(_payload3());

        assertEq(totalPaid, 6 ether);
        assertEq(paidCount, 3);
        assertEq(failedCount, 0);
    }

    function test_distribute_emitsPaidPerRecipient() public {
        vm.expectEmit(true, false, false, true);
        emit Paid(alice, 1 ether, 0);
        vm.expectEmit(true, false, false, true);
        emit Paid(bob, 2 ether, 1);
        vm.expectEmit(true, false, false, true);
        emit Paid(carol, 3 ether, 2);
        vm.expectEmit(true, false, false, true);
        emit Distributed(sender, 6 ether, 3, 0);

        vm.prank(sender);
        multisend.distribute{ value: 6 ether }(_payload3());
    }

    /*//////////////////////////////////////////////////////////////
                          THE NO-CUSTODY INVARIANT
    //////////////////////////////////////////////////////////////*/

    /// @dev The property the whole contract rests on: unlike an ERC-20
    /// `transferFrom` failure (tokens simply never leave the sender), native
    /// value is already inside the contract once sent as `msg.value` — this
    /// proves it comes back out, every time, rather than accumulating.
    function test_distribute_neverRetainsBalance() public {
        vm.prank(sender);
        multisend.distribute{ value: 6 ether }(_payload3());
        assertEq(address(multisend).balance, 0);
    }

    function test_distribute_isolatesRejectingRecipient() public {
        RevertingReceiver rejector = new RevertingReceiver();
        bytes memory payload = bytes.concat(
            _entry(alice, 1 ether), _entry(address(rejector), 2 ether), _entry(carol, 3 ether)
        );

        uint256 senderBefore = sender.balance;
        vm.prank(sender);
        multisend.distribute{ value: 6 ether }(payload);

        assertEq(alice.balance, 1 ether);
        assertEq(address(rejector).balance, 0);
        assertEq(carol.balance, 3 ether, "a rejecting recipient must not stop the run");
        // The rejected 2 ether comes back to the sender, not the contract.
        assertEq(sender.balance, senderBefore - 4 ether, "only the delivered amount is spent");
        assertEq(address(multisend).balance, 0, "nothing left behind");
    }

    function test_distribute_emitsPaymentFailedForRejected() public {
        RevertingReceiver rejector = new RevertingReceiver();
        bytes memory payload = _entry(address(rejector), 1 ether);

        vm.expectEmit(true, false, false, true);
        emit PaymentFailed(address(rejector), 1 ether, 0);
        vm.prank(sender);
        multisend.distribute{ value: 1 ether }(payload);
    }

    /*//////////////////////////////////////////////////////////////
                                VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_distribute_rejectsZeroRecipient() public {
        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(MultisendNative.ZeroRecipient.selector, 0));
        multisend.distribute{ value: 1 ether }(_entry(address(0), 1 ether));
    }

    function test_distribute_rejectsShortValue() public {
        vm.prank(sender);
        vm.expectRevert(MultisendNative.IncorrectValue.selector);
        multisend.distribute{ value: 5 ether }(_payload3()); // needs 6
    }

    function test_distribute_rejectsExcessValue() public {
        vm.prank(sender);
        vm.expectRevert(MultisendNative.IncorrectValue.selector);
        multisend.distribute{ value: 7 ether }(_payload3()); // needs 6
    }

    /*//////////////////////////////////////////////////////////////
                       GAS GRIEFING (the real attack)
    //////////////////////////////////////////////////////////////*/

    /// @dev Not a security control here (only ever moves the caller's own
    /// value), but a correctness one: without it, an under-gassed call would
    /// have every transfer caught and recorded as failed, making a legitimate
    /// sender's recipients look like they rejected the payment.
    function test_distribute_gasFloorRevertsRatherThanMislabeling() public {
        GasBurnerReceiver burner = new GasBurnerReceiver();
        bytes memory payload =
            bytes.concat(_entry(alice, 1 ether), _entry(address(burner), 1 ether));

        vm.prank(sender);
        vm.expectRevert();
        multisend.distribute{ gas: 200_000, value: 2 ether }(payload);
    }

    /*//////////////////////////////////////////////////////////////
                              REFUND FAILURE
    //////////////////////////////////////////////////////////////*/

    /// @dev If the caller itself can't receive its own refund, the whole
    /// distribution reverts rather than stranding the undelivered MON in this
    /// contract — proven by a caller contract with no receive()/fallback.
    function test_distribute_revertsIfCallerCannotReceiveRefund() public {
        RevertingReceiver rejector = new RevertingReceiver();
        RefundRejecter caller = new RefundRejecter();
        vm.deal(address(caller), 10 ether);

        bytes memory payload = _entry(address(rejector), 1 ether);
        bytes memory data = abi.encodeCall(MultisendNative.distribute, (payload));

        vm.expectRevert();
        caller.call{ value: 1 ether }(address(multisend), data, 1 ether);
    }

    /*//////////////////////////////////////////////////////////////
                                REENTRANCY
    //////////////////////////////////////////////////////////////*/

    function test_distribute_reentrancyGuardBlocksReentry() public {
        ReentrantNativeCaller attacker = new ReentrantNativeCaller(multisend);
        uint256 attackerSeed = 10 ether;
        vm.deal(address(attacker), attackerSeed);

        bytes memory payload = _entry(address(attacker), 1 ether);
        vm.prank(sender);
        multisend.distribute{ value: 1 ether }(payload);

        // The reentrant call must have been attempted and must have failed —
        // proving the guard actually fired, not merely that nothing tried it.
        assertTrue(attacker.reentryAttempted());
        assertFalse(attacker.reentrySucceeded());
        // And despite the reentrant attempt failing (and its value transfer
        // unwinding with it), the outer transfer to this same recipient must
        // still have landed — one blocked reentry must not also cancel the
        // legitimate payment. Balance = its own seed (untouched, since the
        // reentrant send reverted) plus the 1 ether the outer call delivered.
        assertEq(address(attacker).balance, attackerSeed + 1 ether);
    }
}

/// @dev Attempts to reenter `distribute` from inside `receive()`. The
/// reentrant call is wrapped in a low-level call so a revert there doesn't
/// unwind the outer transfer being tested.
contract ReentrantNativeCaller {
    MultisendNative public target;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    bool private attacked;

    constructor(MultisendNative target_) {
        target = target_;
    }

    receive() external payable {
        if (!attacked) {
            attacked = true;
            reentryAttempted = true;
            bytes memory payload = abi.encodePacked(address(this), uint128(1 ether));
            bytes memory data = abi.encodeCall(MultisendNative.distribute, (payload));
            (bool ok,) = address(target).call{ value: 1 ether }(data);
            reentrySucceeded = ok;
        }
    }
}
