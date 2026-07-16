// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Multisend } from "../src/Multisend.sol";
import { PayloadLib } from "../src/PayloadLib.sol";
import {
    StandardToken,
    NoReturnToken,
    FalseReturnToken,
    BlocklistToken,
    WeirdReturnToken,
    ReentrantToken,
    GasBurnerToken
} from "./mocks/MockTokens.sol";

contract MultisendTest is Test {
    Multisend internal multisend;
    StandardToken internal token;

    address internal sender = makeAddr("sender");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    event Paid(address indexed token, address indexed recipient, uint256 amount, uint256 index);
    event PaymentFailed(
        address indexed token, address indexed recipient, uint256 amount, uint256 index
    );
    event Distributed(
        address indexed sender,
        address indexed token,
        uint256 totalPaid,
        uint256 paidCount,
        uint256 failedCount
    );

    function setUp() public {
        multisend = new Multisend();
        token = new StandardToken();
        token.mint(sender, 1_000_000 ether);
        vm.prank(sender);
        token.approve(address(multisend), type(uint256).max);
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
        (uint256 totalPaid, uint256 paidCount, uint256 failedCount) =
            multisend.distribute(IERC20(address(token)), _payload3());

        assertEq(totalPaid, 6 ether, "totalPaid");
        assertEq(paidCount, 3, "paidCount");
        assertEq(failedCount, 0, "failedCount");

        assertEq(token.balanceOf(alice), 1 ether);
        assertEq(token.balanceOf(bob), 2 ether);
        assertEq(token.balanceOf(carol), 3 ether);
    }

    /// @dev The contract must never hold funds — that property is what removes
    /// the need for a refund path, and with it the whole state machine.
    function test_distribute_contractNeverHoldsFunds() public {
        vm.prank(sender);
        multisend.distribute(IERC20(address(token)), _payload3());
        assertEq(token.balanceOf(address(multisend)), 0, "multisend must hold nothing");
    }

    function test_distribute_debitsExactlyTheSenderTotal() public {
        uint256 before = token.balanceOf(sender);
        vm.prank(sender);
        multisend.distribute(IERC20(address(token)), _payload3());
        assertEq(before - token.balanceOf(sender), 6 ether);
    }

    function test_distribute_emitsPaidPerRecipientAndSummary() public {
        vm.expectEmit(true, true, false, true);
        emit Paid(address(token), alice, 1 ether, 0);
        vm.expectEmit(true, true, false, true);
        emit Paid(address(token), bob, 2 ether, 1);
        vm.expectEmit(true, true, false, true);
        emit Paid(address(token), carol, 3 ether, 2);
        vm.expectEmit(true, true, false, true);
        emit Distributed(sender, address(token), 6 ether, 3, 0);

        vm.prank(sender);
        multisend.distribute(IERC20(address(token)), _payload3());
    }

    function test_distribute_singleRecipient() public {
        vm.prank(sender);
        (, uint256 paidCount,) =
            multisend.distribute(IERC20(address(token)), _entry(alice, 5 ether));
        assertEq(paidCount, 1);
        assertEq(token.balanceOf(alice), 5 ether);
    }

    /// @dev Duplicates are legal by design (docs/FEATURES.md) — a creator may
    /// intentionally pay one address twice.
    function test_distribute_allowsDuplicateRecipients() public {
        bytes memory payload = bytes.concat(_entry(alice, 1 ether), _entry(alice, 2 ether));
        vm.prank(sender);
        multisend.distribute(IERC20(address(token)), payload);
        assertEq(token.balanceOf(alice), 3 ether);
    }

    function test_distribute_maxUint128Amount() public {
        uint128 max = type(uint128).max;
        token.mint(sender, max);
        vm.prank(sender);
        (uint256 totalPaid,,) = multisend.distribute(IERC20(address(token)), _entry(alice, max));
        assertEq(totalPaid, max, "uint128 ceiling must round-trip");
        assertEq(token.balanceOf(alice), max);
    }

    /*//////////////////////////////////////////////////////////////
                       NON-STANDARD ERC-20 HANDLING
    //////////////////////////////////////////////////////////////*/

    /// @dev USDT-class. A plain IERC20 call would revert decoding the empty
    /// return and mark every payment failed.
    function test_distribute_noReturnToken_treatedAsSuccess() public {
        NoReturnToken t = new NoReturnToken();
        t.mint(sender, 100 ether);
        vm.prank(sender);
        t.approve(address(multisend), 100 ether);

        vm.prank(sender);
        (, uint256 paidCount, uint256 failedCount) =
            multisend.distribute(IERC20(address(t)), _entry(alice, 10 ether));

        assertEq(paidCount, 1, "no-return token must count as paid");
        assertEq(failedCount, 0);
        assertEq(t.balanceOf(alice), 10 ether);
    }

    function test_distribute_falseReturnToken_treatedAsFailure() public {
        FalseReturnToken t = new FalseReturnToken();
        t.mint(sender, 100 ether);
        vm.startPrank(sender);
        t.approve(address(multisend), 100 ether);
        vm.stopPrank();
        t.setFailNext(true);

        vm.prank(sender);
        (uint256 totalPaid, uint256 paidCount, uint256 failedCount) =
            multisend.distribute(IERC20(address(t)), _entry(alice, 10 ether));

        assertEq(paidCount, 0, "a `false` return is a failure, not a payment");
        assertEq(failedCount, 1);
        assertEq(totalPaid, 0);
        assertEq(t.balanceOf(alice), 0);
    }

    function test_distribute_weirdReturnShape_treatedAsFailure() public {
        WeirdReturnToken t = new WeirdReturnToken();
        vm.prank(sender);
        (, uint256 paidCount, uint256 failedCount) =
            multisend.distribute(IERC20(address(t)), _entry(alice, 1 ether));
        assertEq(paidCount, 0, "unexpected return shape must not be guessed as success");
        assertEq(failedCount, 1);
    }

    function test_distribute_revertsOnNonContractToken() public {
        address notAToken = makeAddr("notAToken");
        vm.prank(sender);
        vm.expectRevert(Multisend.TokenNotContract.selector);
        multisend.distribute(IERC20(notAToken), _entry(alice, 1 ether));
    }

    /*//////////////////////////////////////////////////////////////
                          FAILURE ISOLATION
    //////////////////////////////////////////////////////////////*/

    /// @dev The core payroll guarantee: one blocklisted recipient must not
    /// revert the run for everyone else.
    function test_distribute_blockedRecipientDoesNotRevertTheRun() public {
        BlocklistToken t = new BlocklistToken();
        t.mint(sender, 100 ether);
        vm.prank(sender);
        t.approve(address(multisend), 100 ether);
        t.setBlocked(bob, true);

        bytes memory payload =
            bytes.concat(_entry(alice, 1 ether), _entry(bob, 2 ether), _entry(carol, 3 ether));

        vm.prank(sender);
        (uint256 totalPaid, uint256 paidCount, uint256 failedCount) =
            multisend.distribute(IERC20(address(t)), payload);

        assertEq(paidCount, 2, "healthy recipients still paid");
        assertEq(failedCount, 1);
        assertEq(totalPaid, 4 ether);

        assertEq(t.balanceOf(alice), 1 ether);
        assertEq(t.balanceOf(bob), 0, "blocked recipient unpaid");
        assertEq(t.balanceOf(carol), 3 ether);
    }

    /// @dev Failed tokens must remain with the sender — this is what makes the
    /// contract stateless: there is nothing to refund.
    function test_distribute_failedFundsStayWithSender() public {
        BlocklistToken t = new BlocklistToken();
        t.mint(sender, 100 ether);
        vm.prank(sender);
        t.approve(address(multisend), 100 ether);
        t.setBlocked(bob, true);

        uint256 before = t.balanceOf(sender);
        vm.prank(sender);
        multisend.distribute(
            IERC20(address(t)), bytes.concat(_entry(alice, 1 ether), _entry(bob, 2 ether))
        );

        assertEq(
            before - t.balanceOf(sender), 1 ether, "only the delivered amount leaves the sender"
        );
        assertEq(t.balanceOf(address(multisend)), 0);
    }

    function test_distribute_emitsPaymentFailedWithIndex() public {
        BlocklistToken t = new BlocklistToken();
        t.mint(sender, 100 ether);
        vm.prank(sender);
        t.approve(address(multisend), 100 ether);
        t.setBlocked(bob, true);

        vm.expectEmit(true, true, false, true);
        emit PaymentFailed(address(t), bob, 2 ether, 1);

        vm.prank(sender);
        multisend.distribute(
            IERC20(address(t)), bytes.concat(_entry(alice, 1 ether), _entry(bob, 2 ether))
        );
    }

    /// @dev Retry is just a second call with the failed subset — no contract
    /// support needed.
    function test_distribute_retryOfFailedSubsetSucceeds() public {
        BlocklistToken t = new BlocklistToken();
        t.mint(sender, 100 ether);
        vm.prank(sender);
        t.approve(address(multisend), 100 ether);
        t.setBlocked(bob, true);

        vm.prank(sender);
        multisend.distribute(
            IERC20(address(t)), bytes.concat(_entry(alice, 1 ether), _entry(bob, 2 ether))
        );

        t.setBlocked(bob, false); // the recipient sorts out their status

        vm.prank(sender);
        (, uint256 paidCount,) = multisend.distribute(IERC20(address(t)), _entry(bob, 2 ether));

        assertEq(paidCount, 1);
        assertEq(t.balanceOf(bob), 2 ether);
        assertEq(t.balanceOf(alice), 1 ether, "already-paid recipient not paid twice");
    }

    function test_distribute_insufficientAllowanceIsIsolatedFailure() public {
        address poor = makeAddr("poor");
        token.mint(poor, 100 ether);
        vm.prank(poor);
        token.approve(address(multisend), 1 ether); // not enough for the second entry

        vm.prank(poor);
        (, uint256 paidCount, uint256 failedCount) = multisend.distribute(
            IERC20(address(token)), bytes.concat(_entry(alice, 1 ether), _entry(bob, 5 ether))
        );

        assertEq(paidCount, 1);
        assertEq(failedCount, 1);
    }

    function test_distribute_insufficientBalanceIsIsolatedFailure() public {
        address poor = makeAddr("poor");
        token.mint(poor, 1 ether);
        vm.prank(poor);
        token.approve(address(multisend), type(uint256).max);

        vm.prank(poor);
        (, uint256 paidCount, uint256 failedCount) = multisend.distribute(
            IERC20(address(token)), bytes.concat(_entry(alice, 1 ether), _entry(bob, 5 ether))
        );

        assertEq(paidCount, 1);
        assertEq(failedCount, 1);
    }

    /*//////////////////////////////////////////////////////////////
                            PAYLOAD VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_distribute_revertsOnEmptyPayload() public {
        vm.prank(sender);
        vm.expectRevert(PayloadLib.EmptyPayload.selector);
        multisend.distribute(IERC20(address(token)), "");
    }

    function test_distribute_revertsOnRaggedPayload() public {
        vm.prank(sender);
        vm.expectRevert(PayloadLib.InvalidPayloadLength.selector);
        multisend.distribute(IERC20(address(token)), hex"deadbeef");
    }

    function test_distribute_revertsOnZeroRecipient() public {
        bytes memory payload = bytes.concat(_entry(alice, 1 ether), _entry(address(0), 2 ether));
        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Multisend.ZeroRecipient.selector, 1));
        multisend.distribute(IERC20(address(token)), payload);
    }

    /// @dev A zero recipient reverts the whole call, so the earlier transfers in
    /// the same payload must be rolled back too — no partial burn-adjacent state.
    function test_distribute_zeroRecipientRollsBackEarlierTransfers() public {
        bytes memory payload = bytes.concat(_entry(alice, 1 ether), _entry(address(0), 2 ether));
        vm.prank(sender);
        vm.expectRevert(abi.encodeWithSelector(Multisend.ZeroRecipient.selector, 1));
        multisend.distribute(IERC20(address(token)), payload);
        assertEq(token.balanceOf(alice), 0, "reverted run must pay nobody");
    }

    /*//////////////////////////////////////////////////////////////
                           DECODING CORRECTNESS
    //////////////////////////////////////////////////////////////*/

    /// @dev The last entry's amount is read with a word load that runs past the
    /// payload's end; the bytes beyond must be shifted out, not misread.
    function test_distribute_lastEntryDecodesCorrectly() public {
        bytes memory payload = bytes.concat(_entry(alice, 1 ether), _entry(bob, 7 ether));
        vm.prank(sender);
        multisend.distribute(IERC20(address(token)), payload);
        assertEq(token.balanceOf(bob), 7 ether, "trailing entry must not absorb adjacent calldata");
    }

    function testFuzz_distribute_decodesEntries(address r1, uint96 a1, address r2, uint96 a2)
        public
    {
        vm.assume(r1 != address(0) && r2 != address(0));
        vm.assume(r1 != r2);
        vm.assume(r1 != sender && r2 != sender);
        vm.assume(uint256(a1) + uint256(a2) > 0);

        token.mint(sender, uint256(a1) + uint256(a2));
        uint256 b1 = token.balanceOf(r1);
        uint256 b2 = token.balanceOf(r2);

        bytes memory payload = bytes.concat(_entry(r1, a1), _entry(r2, a2));
        vm.prank(sender);
        (uint256 totalPaid,,) = multisend.distribute(IERC20(address(token)), payload);

        assertEq(totalPaid, uint256(a1) + uint256(a2));
        assertEq(token.balanceOf(r1) - b1, a1);
        assertEq(token.balanceOf(r2) - b2, a2);
    }

    function testFuzz_distribute_neverRetainsBalance(uint8 n, uint96 amount) public {
        n = uint8(bound(n, 1, 40));
        vm.assume(amount > 0);
        token.mint(sender, uint256(amount) * n);

        bytes memory payload;
        for (uint256 i; i < n; ++i) {
            payload = bytes.concat(payload, _entry(address(uint160(i + 1000)), amount));
        }

        vm.prank(sender);
        multisend.distribute(IERC20(address(token)), payload);
        assertEq(token.balanceOf(address(multisend)), 0, "invariant: contract holds nothing");
    }

    /*//////////////////////////////////////////////////////////////
                              REENTRANCY
    //////////////////////////////////////////////////////////////*/

    function test_distribute_reentrancyIsBlocked() public {
        ReentrantToken t = new ReentrantToken();
        t.mint(sender, 100 ether);
        vm.prank(sender);
        t.approve(address(multisend), 100 ether);

        bytes memory inner =
            abi.encodeCall(Multisend.distribute, (IERC20(address(t)), _entry(carol, 1 ether)));
        t.setAttack(address(multisend), inner);

        vm.prank(sender);
        multisend.distribute(IERC20(address(t)), _entry(alice, 1 ether));

        // Prove the attack actually fired — otherwise the assertions below pass vacuously.
        assertTrue(t.reentryAttempted(), "test is vacuous unless reentry was attempted");
        assertFalse(t.reentrySucceeded(), "reentrant call must be rejected by the guard");

        assertEq(t.balanceOf(carol), 0, "reentrant distribution must not pay out");
        assertEq(t.balanceOf(alice), 1 ether, "outer distribution still completes");
    }

    /*//////////////////////////////////////////////////////////////
                               GAS FLOOR
    //////////////////////////////////////////////////////////////*/

    /// @dev With too little gas the run must revert cleanly rather than record
    /// healthy recipients as failed. Without the floor, a token consuming all
    /// forwarded gas would be caught and reported as a rejection.
    function test_distribute_revertsRatherThanFalselyReportingFailure() public {
        GasBurnerToken t = new GasBurnerToken();
        t.mint(sender, 100 ether);
        vm.prank(sender);
        t.approve(address(multisend), 100 ether);

        bytes memory payload = bytes.concat(_entry(alice, 1 ether), _entry(bob, 1 ether));

        vm.prank(sender);
        // The first entry burns the forwarded gas; by the second the floor trips.
        vm.expectRevert(abi.encodeWithSelector(Multisend.InsufficientGas.selector, 1));
        multisend.distribute{ gas: 400_000 }(IERC20(address(t)), payload);
    }
}
