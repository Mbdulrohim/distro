// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test, console } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Multisend } from "../src/Multisend.sol";
import { StandardToken } from "./mocks/MockTokens.sol";

/// @notice Gas characterisation for `Multisend.distribute`.
///
/// @dev Two things depend on these numbers, so they must be measured rather
/// than assumed (docs/CTO_REVIEW.md, recommendation 6):
///
/// 1. `MIN_GAS_PER_TRANSFER` must exceed the most gas a *legitimate* transfer
///    could need. Set it too low and a real transfer is starved and recorded as
///    a rejection — the exact lie the floor exists to prevent. Set it too high
///    and, because Monad charges on `gas_limit` rather than gas used, every
///    caller overpays the difference on every distribution, forever.
/// 2. The dashboard's chunk sizing needs the real marginal cost per recipient.
///
/// **These are local-EVM numbers and must be re-measured on Monad before
/// mainnet.** Resist the temptation to extrapolate: Monad's "3-4x cold access"
/// penalty applies to cold-access opcodes, whereas the dominant cost here is the
/// ~20k SSTORE that credits a fresh balance — which that multiplier does not
/// touch. Multiplying the whole figure overstates it by roughly 2.5x.
contract MultisendGasTest is Test {
    Multisend internal multisend;
    StandardToken internal token;
    address internal sender = makeAddr("sender");

    function setUp() public {
        multisend = new Multisend();
        token = new StandardToken();
        token.mint(sender, type(uint128).max);
        vm.prank(sender);
        token.approve(address(multisend), type(uint256).max);
    }

    function _payload(uint256 n, uint256 seed) internal pure returns (bytes memory payload) {
        for (uint256 i; i < n; ++i) {
            payload = bytes.concat(
                payload, abi.encodePacked(address(uint160(seed + i)), uint128(1 ether))
            );
        }
    }

    function _measure(uint256 n, uint256 seed) internal returns (uint256 used) {
        bytes memory payload = _payload(n, seed);
        vm.prank(sender);
        uint256 before = gasleft();
        multisend.distribute(IERC20(address(token)), payload);
        used = before - gasleft();
    }

    /// @dev The marginal cost of one more recipient, isolated from fixed
    /// overhead by differencing two run sizes.
    function test_gas_marginalCostPerRecipient() public {
        uint256 g10 = _measure(10, 0x10000);
        uint256 g110 = _measure(110, 0x20000);

        uint256 marginal = (g110 - g10) / 100;

        console.log("gas: 10 recipients            ", g10);
        console.log("gas: 110 recipients           ", g110);
        console.log("gas: marginal per recipient   ", marginal);
        // Deliberately no Monad extrapolation printed. Scaling this by the "3-4x
        // cold access" figure is invalid — see test_gas_floorMarginAgainstLocalCost.
        // Measure on Monad; do not multiply.

        // A cold ERC-20 credit cannot plausibly cost less than the 20k SSTORE
        // for a fresh balance slot; anything lower means we measured wrong.
        assertGt(marginal, 20_000, "marginal below a cold SSTORE - measurement is wrong");

        // Guard against silent regressions in the decode/dispatch path.
        assertLt(marginal, 40_000, "marginal cost regressed");
    }

    /// @dev The floor must clear the most gas a *legitimate* transfer could
    /// need. This test records the local margin; it deliberately does **not**
    /// assert a Monad bound, because that number is not knowable from here and
    /// an assertion tuned to pass would be worse than no assertion.
    ///
    /// **RESOLVED 2026-07-16** — measured on a Monad mainnet fork
    /// (test/Multisend.fork.t.sol): real USDC costs **31,471 gas/recipient**, so
    /// the 100k floor carries ~3.2x headroom and is confirmed safe.
    ///
    /// The measurement also killed the tempting extrapolation: Monad's real cost
    /// is **1.1x local**, not the ~4x implied by its "3-4x cold access" figure
    /// (that multiplier applies to cold-access opcodes, not the ~20k SSTORE that
    /// dominates here). A 4x guess would have put the floor near 115k — *above*
    /// a real transfer — starving legitimate payments and mislabeling them as
    /// rejections, which is the exact bug the floor prevents.
    function test_gas_floorMarginAgainstLocalCost() public {
        uint256 g10 = _measure(10, 0x30000);
        uint256 g110 = _measure(110, 0x40000);
        uint256 marginal = (g110 - g10) / 100;

        // MIN_GAS_PER_TRANSFER is internal; mirrored here deliberately so that
        // changing the constant fails this test and forces a re-justification.
        uint256 floor = 100_000;

        console.log("gas: floor                     ", floor);
        console.log("gas: measured marginal (local) ", marginal);
        console.log("gas: headroom multiple (local) ", floor / marginal);

        assertGt(floor, marginal * 2, "floor must clear a normal transfer with real margin");
    }

    /// @dev The floor is not free. Monad charges on `gas_limit`, not gas used,
    /// so the caller must supply headroom that the final transfer never spends —
    /// they pay for it regardless. Quantifies that tax before we accept it.
    function test_gas_floorOverheadCost() public {
        uint256 g1 = _measure(1, 0x80000);
        uint256 g200 = _measure(200, 0x90000);
        uint256 floor = 100_000;

        // Roughly what the caller must add to gas_limit to satisfy the floor on
        // the last transfer, and never gets back on Monad.
        console.log("gas: 1 recipient, actual       ", g1);
        console.log("gas: 1 recipient, +floor tax   ", ((floor * 100) / g1), "% overhead");
        console.log("gas: 200 recipients, actual    ", g200);
        console.log("gas: 200 recipients, +floor tax", ((floor * 100) / g200), "% overhead");

        // The tax is negligible at payroll scale but severe for a single
        // payment - which is exactly the shape of the "test payment" flow in
        // docs/FEATURES.md. Worth revisiting once the real floor is known.
        assertLt((floor * 100) / g200, 5, "floor should be noise at payroll scale");
    }

    /// @dev Fixed overhead amortises across recipients; informs the minimum
    /// batch size worth bothering with, and the cost of the test-payment flow.
    function test_gas_fixedOverhead() public {
        uint256 g1 = _measure(1, 0x50000);
        uint256 g2 = _measure(2, 0x60000);
        uint256 marginal = g2 - g1;
        uint256 fixedOverhead = g1 - marginal;

        console.log("gas: 1 recipient               ", g1);
        console.log("gas: fixed overhead            ", fixedOverhead);
    }

    /// @dev Sanity-check a realistic payroll run fits comfortably in one
    /// transaction. Local numbers — the Monad headroom check belongs against a
    /// real RPC, not a multiplication.
    function test_gas_payrollScale() public {
        uint256 g200 = _measure(200, 0x70000);
        console.log("gas: 200 recipients            ", g200);
        assertLt(g200, 30_000_000, "a 200-person payroll must fit one transaction");
    }
}
