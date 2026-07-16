// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { DistributionFactory } from "../src/DistributionFactory.sol";
import { Distribution } from "../src/Distribution.sol";
import { PayloadLib } from "../src/PayloadLib.sol";
import {
    StandardToken,
    BlocklistToken,
    NoReturnToken,
    TransferGasBurnerToken
} from "./mocks/MockTokens.sol";

contract DistributionTest is Test {
    DistributionFactory internal factory;
    StandardToken internal token;

    address internal owner = makeAddr("owner"); // stands in for the Safe multisig
    address internal treasury = makeAddr("treasury");
    address internal creator = makeAddr("creator");
    address internal keeper = makeAddr("keeper");
    address internal stranger = makeAddr("stranger");

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint64 internal executeAfter;

    function setUp() public {
        vm.warp(1_800_000_000);
        executeAfter = uint64(block.timestamp + 1 days);

        factory = new DistributionFactory(owner, treasury);
        token = new StandardToken();
        token.mint(creator, 1_000_000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    function _entry(address r, uint128 a) internal pure returns (bytes memory) {
        return abi.encodePacked(r, a);
    }

    function _payload3() internal view returns (bytes memory) {
        return bytes.concat(_entry(alice, 1 ether), _entry(bob, 2 ether), _entry(carol, 3 ether));
    }

    function _create(address token_, uint32 chunks, bytes32 salt) internal returns (Distribution) {
        vm.prank(creator);
        return Distribution(factory.createDistribution(token_, executeAfter, chunks, salt));
    }

    /// Create → commit one chunk → fund. The common starting point.
    function _fundedWith(bytes memory payload) internal returns (Distribution d) {
        d = _create(address(token), 1, bytes32(uint256(1)));
        vm.prank(creator);
        d.commitChunk(0, payload);
        vm.startPrank(creator);
        token.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          FACTORY / LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    function test_create_deploysAtPredictedAddress() public {
        address predicted = factory.predictAddress(creator, bytes32(uint256(1)));
        Distribution d = _create(address(token), 1, bytes32(uint256(1)));
        assertEq(address(d), predicted, "dashboard must be able to show the address before deploy");
    }

    /// @dev The double-funding guard: two payrolls from one double-click would
    /// pay everyone twice, and a push model has no clawback.
    function test_create_revertsOnDuplicateSalt() public {
        _create(address(token), 1, bytes32(uint256(1)));
        vm.prank(creator);
        vm.expectRevert();
        factory.createDistribution(address(token), executeAfter, 1, bytes32(uint256(1)));
    }

    function test_create_sameSaltDifferentCreatorsIsFine() public {
        _create(address(token), 1, bytes32(uint256(1)));
        vm.prank(stranger);
        address d = factory.createDistribution(address(token), executeAfter, 1, bytes32(uint256(1)));
        assertTrue(d != address(0));
    }

    function test_initialize_cannotBeCalledTwice() public {
        Distribution d = _create(address(token), 1, bytes32(uint256(1)));
        vm.expectRevert(Distribution.AlreadyInitialized.selector);
        d.initialize(stranger, address(token), executeAfter, 1, 0, treasury);
    }

    /*//////////////////////////////////////////////////////////////
                                 COMMIT
    //////////////////////////////////////////////////////////////*/

    /// @dev The data-availability guarantee — without this event, only Distro
    /// could execute, and the whole escrow rationale collapses.
    function test_commit_emitsFullPayloadOnchain() public {
        Distribution d = _create(address(token), 1, bytes32(uint256(1)));
        bytes memory payload = _payload3();

        vm.expectEmit(true, false, false, true);
        emit Distribution.RecipientsCommitted(0, payload);
        vm.prank(creator);
        d.commitChunk(0, payload);
    }

    /// @dev The contract computes the total itself; a creator can't understate it.
    function test_commit_contractComputesTotalItself() public {
        Distribution d = _create(address(token), 1, bytes32(uint256(1)));
        vm.prank(creator);
        d.commitChunk(0, _payload3());
        assertEq(d.totalAmount(), 6 ether);
    }

    function test_commit_onlyCreator() public {
        Distribution d = _create(address(token), 1, bytes32(uint256(1)));
        vm.prank(stranger);
        vm.expectRevert(Distribution.NotCreator.selector);
        d.commitChunk(0, _payload3());
    }

    function test_commit_rejectsZeroRecipientAndZeroAmount() public {
        Distribution d = _create(address(token), 1, bytes32(uint256(1)));
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(Distribution.ZeroRecipient.selector, 0));
        d.commitChunk(0, _entry(address(0), 1 ether));
        vm.expectRevert(abi.encodeWithSelector(Distribution.ZeroAmount.selector, 0));
        d.commitChunk(0, _entry(alice, 0));
        vm.stopPrank();
    }

    function test_commit_readyOnlyAfterAllChunks() public {
        Distribution d = _create(address(token), 2, bytes32(uint256(1)));
        vm.startPrank(creator);
        d.commitChunk(0, _entry(alice, 1 ether));
        assertEq(uint8(d.state()), uint8(Distribution.State.Draft));
        d.commitChunk(1, _entry(bob, 2 ether));
        assertEq(uint8(d.state()), uint8(Distribution.State.Ready));
        vm.stopPrank();
    }

    function test_commit_rejectsDuplicateChunk() public {
        Distribution d = _create(address(token), 2, bytes32(uint256(1)));
        vm.startPrank(creator);
        d.commitChunk(0, _entry(alice, 1 ether));
        vm.expectRevert(Distribution.ChunkAlreadyCommitted.selector);
        d.commitChunk(0, _entry(bob, 1 ether));
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                                  FUND
    //////////////////////////////////////////////////////////////*/

    function test_fund_escrowsExactTotal() public {
        Distribution d = _fundedWith(_payload3());
        assertEq(token.balanceOf(address(d)), 6 ether);
        assertEq(uint8(d.state()), uint8(Distribution.State.Funded));
    }

    /// @dev Funding is permissionless — a treasury multisig may not be the creator.
    function test_fund_byAnyone() public {
        Distribution d = _create(address(token), 1, bytes32(uint256(1)));
        vm.prank(creator);
        d.commitChunk(0, _payload3());

        token.mint(stranger, 100 ether);
        vm.startPrank(stranger);
        token.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();

        assertEq(token.balanceOf(address(d)), 6 ether);
    }

    function test_fund_chargesFeeToTreasury() public {
        vm.prank(owner);
        factory.setFee(100, treasury); // 1%, the cap

        Distribution d = _fundedWith(_payload3());
        assertEq(token.balanceOf(treasury), 0.06 ether, "1% of 6 ether");
        assertEq(token.balanceOf(address(d)), 6 ether, "recipients still fully covered");
    }

    /// @dev A fee change must never reach a distribution that already exists.
    function test_fund_feeCapturedAtCreationNotFundTime() public {
        Distribution d = _create(address(token), 1, bytes32(uint256(1)));
        vm.prank(creator);
        d.commitChunk(0, _payload3());

        vm.prank(owner);
        factory.setFee(100, treasury); // raised AFTER creation

        vm.startPrank(creator);
        token.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();

        assertEq(token.balanceOf(treasury), 0, "fee agreed at creation was zero");
    }

    function test_setFee_cannotExceedCap() public {
        vm.prank(owner);
        vm.expectRevert(DistributionFactory.FeeTooHigh.selector);
        factory.setFee(101, treasury);
    }

    /*//////////////////////////////////////////////////////////////
                                EXECUTE
    //////////////////////////////////////////////////////////////*/

    function test_execute_revertsBeforeSchedule() public {
        Distribution d = _fundedWith(_payload3());
        vm.expectRevert(Distribution.TooEarly.selector);
        d.executeChunk(0, _payload3());
    }

    /// @dev The whole point: a run survives Distro disappearing.
    function test_execute_byAnyone() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(executeAfter);

        vm.prank(stranger);
        d.executeChunk(0, _payload3());

        assertEq(token.balanceOf(alice), 1 ether);
        assertEq(token.balanceOf(bob), 2 ether);
        assertEq(token.balanceOf(carol), 3 ether);
        assertEq(uint8(d.state()), uint8(Distribution.State.Completed));
    }

    /// @dev A permissionless executor must not be able to substitute recipients.
    function test_execute_rejectsTamperedPayload() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(executeAfter);

        bytes memory tampered =
            bytes.concat(_entry(stranger, 1 ether), _entry(bob, 2 ether), _entry(carol, 3 ether));
        vm.prank(stranger);
        vm.expectRevert(Distribution.PayloadMismatch.selector);
        d.executeChunk(0, tampered);
    }

    /// @dev A payload must not be replayable against a different chunk index.
    function test_execute_rejectsPayloadFromAnotherChunk() public {
        Distribution d = _create(address(token), 2, bytes32(uint256(1)));
        vm.startPrank(creator);
        d.commitChunk(0, _entry(alice, 1 ether));
        d.commitChunk(1, _entry(bob, 2 ether));
        token.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();
        vm.warp(executeAfter);

        vm.expectRevert(Distribution.PayloadMismatch.selector);
        d.executeChunk(1, _entry(alice, 1 ether)); // chunk 0's payload
    }

    /// @dev Two chunks on purpose. With one, the run completes and the state
    /// guard fires first (WrongState) — which is a correct rejection but tests
    /// the wrong thing. Two chunks leaves the distribution Executing, so a
    /// replay actually reaches the ChunkAlreadyExecuted guard.
    function test_execute_rejectsDoubleExecution() public {
        Distribution d = _create(address(token), 2, bytes32(uint256(1)));
        vm.startPrank(creator);
        d.commitChunk(0, _entry(alice, 1 ether));
        d.commitChunk(1, _entry(bob, 2 ether));
        token.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();
        vm.warp(executeAfter);

        d.executeChunk(0, _entry(alice, 1 ether));
        assertEq(uint8(d.state()), uint8(Distribution.State.Executing));

        vm.expectRevert(Distribution.ChunkAlreadyExecuted.selector);
        d.executeChunk(0, _entry(alice, 1 ether));
        assertEq(token.balanceOf(alice), 1 ether, "must not pay twice");
    }

    /// @dev And once completed, the state guard rejects any further execution.
    function test_execute_rejectsAfterCompletion() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(executeAfter);
        d.executeChunk(0, _payload3());
        vm.expectRevert(Distribution.WrongState.selector);
        d.executeChunk(0, _payload3());
    }

    function test_execute_isolatesFailures() public {
        BlocklistToken bt = new BlocklistToken();
        bt.mint(creator, 100 ether);
        Distribution d = _create(address(bt), 1, bytes32(uint256(1)));
        vm.startPrank(creator);
        d.commitChunk(0, _payload3());
        bt.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();

        bt.setBlocked(bob, true);
        vm.warp(executeAfter);
        d.executeChunk(0, _payload3());

        assertEq(bt.balanceOf(alice), 1 ether);
        assertEq(bt.balanceOf(bob), 0);
        assertEq(bt.balanceOf(carol), 3 ether, "a blocked recipient must not stop the run");
        assertEq(d.failedAmount(), 2 ether);
        assertEq(d.totalPaid(), 4 ether);
    }

    /// @dev USDT-class: returns nothing. A plain IERC20.transfer would revert
    /// decoding the empty return and mark every payment failed.
    function test_execute_noReturnTokenCountsAsPaid() public {
        NoReturnToken nrt = new NoReturnToken();
        nrt.mint(creator, 100 ether);
        Distribution d = _create(address(nrt), 1, bytes32(uint256(1)));
        vm.startPrank(creator);
        d.commitChunk(0, _entry(alice, 5 ether));
        nrt.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();

        vm.warp(executeAfter);
        d.executeChunk(0, _entry(alice, 5 ether));

        assertEq(nrt.balanceOf(alice), 5 ether);
        assertEq(d.failedAmount(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                       GAS GRIEFING (the real attack)
    //////////////////////////////////////////////////////////////*/

    /// @dev Execution is permissionless, so without a gas floor an attacker
    /// calls executeChunk with just enough gas to enter the loop but not
    /// complete the transfers: every payment is caught and recorded failed, the
    /// chunk marks itself executed, and one cheap tx poisons a payroll run.
    /// The floor must turn that into a revert that writes nothing.
    /// @dev Asserts the *property* (the attack reverts), deliberately not a
    /// specific revert reason.
    ///
    /// The escrow can fail two ways here and both are correct. EIP-150 leaves
    /// the caller 1/64 of gas after the token burns everything forwarded to it
    /// — roughly 5k. `Multisend` only touches memory when recording a failure,
    /// so it reaches the `InsufficientGas` check. The escrow instead writes
    /// storage (`failed[chunk][pos]`, `failedAmount` — two cold SSTOREs, ~40k),
    /// which does not fit in what EIP-150 returns, so it dies of plain
    /// out-of-gas *before* the check. Pinning this to `InsufficientGas` would
    /// be asserting an implementation detail of the gas schedule, and would
    /// break on a tuning change that left the contract just as safe.
    ///
    /// What must never happen is that it *succeeds* and records false failures.
    /// `test_execute_griefedChunkIsNotMarkedExecuted` proves that directly.
    function test_execute_gasGriefingReverts() public {
        TransferGasBurnerToken gt = new TransferGasBurnerToken();
        gt.mint(creator, 100 ether);
        Distribution d = _create(address(gt), 1, bytes32(uint256(1)));
        bytes memory payload = bytes.concat(_entry(alice, 1 ether), _entry(bob, 1 ether));
        vm.startPrank(creator);
        d.commitChunk(0, payload);
        gt.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();
        vm.warp(executeAfter);

        vm.prank(stranger);
        vm.expectRevert();
        d.executeChunk{ gas: 400_000 }(0, payload);
    }

    /// @dev The governing invariant: an execution either records true outcomes
    /// or reverts entirely. Never a chunk marked executed with false failures.
    function test_execute_griefedChunkIsNotMarkedExecuted() public {
        TransferGasBurnerToken gt = new TransferGasBurnerToken();
        gt.mint(creator, 100 ether);
        Distribution d = _create(address(gt), 1, bytes32(uint256(1)));
        bytes memory payload = bytes.concat(_entry(alice, 1 ether), _entry(bob, 1 ether));
        vm.startPrank(creator);
        d.commitChunk(0, payload);
        gt.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();
        vm.warp(executeAfter);

        vm.prank(stranger);
        try d.executeChunk{ gas: 400_000 }(0, payload) { } catch { }

        assertFalse(d.chunkExecuted(0), "a griefed chunk must remain executable");
        assertEq(d.failedAmount(), 0, "no false failures recorded");
        assertEq(uint8(d.state()), uint8(Distribution.State.Funded), "state untouched");
    }

    /*//////////////////////////////////////////////////////////////
                                 RETRY
    //////////////////////////////////////////////////////////////*/

    function test_retry_paysPreviouslyFailedRecipient() public {
        BlocklistToken bt = new BlocklistToken();
        bt.mint(creator, 100 ether);
        Distribution d = _create(address(bt), 1, bytes32(uint256(1)));
        vm.startPrank(creator);
        d.commitChunk(0, _payload3());
        bt.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();

        bt.setBlocked(bob, true);
        vm.warp(executeAfter);
        d.executeChunk(0, _payload3());

        bt.setBlocked(bob, false);
        uint256[] memory positions = new uint256[](1);
        positions[0] = 1;
        d.retry(0, _payload3(), positions);

        assertEq(bt.balanceOf(bob), 2 ether);
        assertEq(d.failedAmount(), 0);
        assertEq(d.totalPaid(), 6 ether);
    }

    /// @dev No double-pay: a position is only retryable while flagged failed.
    function test_retry_cannotDoublePaySucceededRecipient() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(executeAfter);
        d.executeChunk(0, _payload3());

        uint256[] memory positions = new uint256[](1);
        positions[0] = 0; // alice already paid
        vm.expectRevert(abi.encodeWithSelector(Distribution.NotFailed.selector, 0));
        d.retry(0, _payload3(), positions);
    }

    function test_retry_rejectsTamperedPayload() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(executeAfter);
        d.executeChunk(0, _payload3());

        uint256[] memory positions = new uint256[](1);
        positions[0] = 0;
        vm.expectRevert(Distribution.PayloadMismatch.selector);
        d.retry(0, _entry(stranger, 1 ether), positions);
    }

    /*//////////////////////////////////////////////////////////////
                           CANCEL / RECLAIM
    //////////////////////////////////////////////////////////////*/

    function test_cancel_refundsCreator() public {
        Distribution d = _fundedWith(_payload3());
        uint256 before = token.balanceOf(creator);

        vm.prank(creator);
        d.cancel();

        assertEq(token.balanceOf(creator) - before, 6 ether);
        assertEq(token.balanceOf(address(d)), 0);
        assertEq(uint8(d.state()), uint8(Distribution.State.Cancelled));
    }

    /// @dev O1: cancellable on execution progress, NOT on time. Gating by
    /// executeAfter would strand funds nobody ever executed.
    function test_cancel_allowedAfterScheduleWhileUnexecuted() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(executeAfter + 30 days); // long past the schedule

        vm.prank(creator);
        d.cancel();
        assertEq(uint8(d.state()), uint8(Distribution.State.Cancelled));
    }

    function test_cancel_blockedOnceAnyChunkExecuted() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(executeAfter);
        d.executeChunk(0, _payload3());

        vm.prank(creator);
        vm.expectRevert(Distribution.WrongState.selector);
        d.cancel();
    }

    function test_cancel_onlyCreator() public {
        Distribution d = _fundedWith(_payload3());
        vm.prank(stranger);
        vm.expectRevert(Distribution.NotCreator.selector);
        d.cancel();
    }

    function test_cancel_blocksExecution() public {
        Distribution d = _fundedWith(_payload3());
        vm.prank(creator);
        d.cancel();
        vm.warp(executeAfter);

        vm.expectRevert(Distribution.WrongState.selector);
        d.executeChunk(0, _payload3());
    }

    function test_reclaim_sweepsUndeliverableAfterCompletion() public {
        BlocklistToken bt = new BlocklistToken();
        bt.mint(creator, 100 ether);
        Distribution d = _create(address(bt), 1, bytes32(uint256(1)));
        vm.startPrank(creator);
        d.commitChunk(0, _payload3());
        bt.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();

        bt.setBlocked(bob, true);
        vm.warp(executeAfter);
        d.executeChunk(0, _payload3());

        uint256 before = bt.balanceOf(creator);
        vm.prank(creator);
        d.reclaim();
        assertEq(bt.balanceOf(creator) - before, 2 ether, "bob's undeliverable share");
        assertEq(bt.balanceOf(address(d)), 0);
    }

    /// @dev The escape hatch. Funded, scheduled, and nobody ever executed —
    /// without this the money is stranded forever, since there is deliberately
    /// no admin path to it.
    function test_reclaim_rescuesStrandedFundsAfterGrace() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(uint256(executeAfter) + d.RECLAIM_GRACE_PERIOD() + 1);

        uint256 before = token.balanceOf(creator);
        vm.prank(creator);
        d.reclaim();
        assertEq(token.balanceOf(creator) - before, 6 ether);
    }

    /// @dev Grace exists so a creator can't front-run a merely-late keeper.
    function test_reclaim_blockedDuringGrace() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(uint256(executeAfter) + 1 days);

        vm.prank(creator);
        vm.expectRevert(Distribution.WrongState.selector);
        d.reclaim();
    }

    function test_reclaim_onlyCreator() public {
        Distribution d = _fundedWith(_payload3());
        vm.warp(uint256(executeAfter) + d.RECLAIM_GRACE_PERIOD() + 1);
        vm.prank(stranger);
        vm.expectRevert(Distribution.NotCreator.selector);
        d.reclaim();
    }

    /*//////////////////////////////////////////////////////////////
                     NO ADMIN PATH TO USER FUNDS
    //////////////////////////////////////////////////////////////*/

    /// @dev The property the entire "not a custodian" claim rests on. Pausing
    /// must block only NEW creation — never freeze a funded run.
    function test_factoryPause_cannotFreezeAFundedDistribution() public {
        Distribution d = _fundedWith(_payload3());

        vm.prank(owner);
        factory.setPaused(true);

        vm.warp(executeAfter);
        vm.prank(stranger);
        d.executeChunk(0, _payload3());

        assertEq(token.balanceOf(alice), 1 ether, "a paused factory must not stop payroll");
    }

    function test_factoryPause_blocksNewCreationOnly() public {
        vm.prank(owner);
        factory.setPaused(true);
        vm.prank(creator);
        vm.expectRevert(DistributionFactory.Paused.selector);
        factory.createDistribution(address(token), executeAfter, 1, bytes32(uint256(9)));
    }

    /// @dev There is no owner-callable function on Distribution at all. If this
    /// ever compiles differently, someone added a backdoor.
    function test_factoryOwner_hasNoPowerOverDistributionFunds() public {
        Distribution d = _fundedWith(_payload3());
        uint256 escrowed = token.balanceOf(address(d));

        vm.startPrank(owner);
        vm.expectRevert(Distribution.NotCreator.selector);
        d.cancel();
        vm.expectRevert(Distribution.NotCreator.selector);
        d.reclaim();
        vm.stopPrank();

        assertEq(token.balanceOf(address(d)), escrowed, "owner cannot touch escrow");
    }

    /*//////////////////////////////////////////////////////////////
                              INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Sum of paid + still-failed + refunded never exceeds what was escrowed.
    function testFuzz_neverPaysOutMoreThanEscrowed(uint96 a1, uint96 a2, uint96 a3) public {
        vm.assume(a1 > 0 && a2 > 0 && a3 > 0);
        uint256 total = uint256(a1) + a2 + a3;
        token.mint(creator, total);

        bytes memory payload = bytes.concat(_entry(alice, a1), _entry(bob, a2), _entry(carol, a3));
        Distribution d = _create(address(token), 1, bytes32(uint256(7)));
        vm.startPrank(creator);
        d.commitChunk(0, payload);
        token.approve(address(d), type(uint256).max);
        d.fund();
        vm.stopPrank();

        assertEq(d.totalAmount(), total);
        vm.warp(executeAfter);
        d.executeChunk(0, payload);

        assertEq(d.totalPaid() + d.failedAmount(), total);
        assertLe(d.totalPaid(), total);
        assertEq(token.balanceOf(address(d)), d.failedAmount(), "escrow holds exactly the failures");
    }

    /// @dev A cancelled distribution can never pay anyone.
    function testFuzz_cancelledNeverPays(uint96 amount) public {
        vm.assume(amount > 0);
        token.mint(creator, amount);
        bytes memory payload = _entry(alice, amount);

        Distribution d = _create(address(token), 1, bytes32(uint256(8)));
        vm.startPrank(creator);
        d.commitChunk(0, payload);
        token.approve(address(d), type(uint256).max);
        d.fund();
        d.cancel();
        vm.stopPrank();

        vm.warp(executeAfter);
        vm.expectRevert(Distribution.WrongState.selector);
        d.executeChunk(0, payload);
        assertEq(token.balanceOf(alice), 0);
    }
}
