// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test, console } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Multisend } from "../src/Multisend.sol";
import { StandardToken } from "./mocks/MockTokens.sol";

/// @notice **Real Monad gas measurement.** This is the test that resolves
/// `MIN_GAS_PER_TRANSFER`, currently a conservative placeholder.
///
/// Run against a Monad fork (it skips otherwise, so `forge test` stays offline):
///
///     forge test --fork-url $MONAD_MAINNET_RPC_URL \
///       --match-path "test/Multisend.fork.t.sol" -vv
///
/// @dev Why this must be measured rather than extrapolated: the obvious move is
/// to take the local marginal cost (~28.6k, see Multisend.gas.t.sol) and
/// multiply by Monad's "3-4x cold access" figure. That is wrong — the
/// multiplier applies to cold-access opcodes (~2.1k SLOAD, ~2.6k account), not
/// to the ~20k SSTORE that dominates crediting a fresh balance. A blanket 4x
/// overstates by roughly 2.5x and would put the floor *above* a real transfer's
/// cost, starving legitimate payments and recording them as rejections.
///
/// Why two tokens: a plain ERC-20 measures Monad's raw opcode pricing, but real
/// tokens cost more (USDC-class contracts do extra SLOADs for blocklist checks).
/// `MIN_GAS_PER_TRANSFER` must clear the *most* a legitimate transfer could
/// need, so a plain-ERC-20 measurement alone would set the floor too low.
///
/// This also double-checks the token registry: if the USDC address is wrong
/// there is no code at it and this fails loudly, rather than a bad address
/// reaching users who would approve and send to the wrong contract.
contract MultisendForkTest is Test {
    /// Monad mainnet USDC — monskills canonical table (see web/src/lib/tokens/registry.ts).
    address internal constant MAINNET_USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
    uint256 internal constant MONAD_MAINNET = 143;

    Multisend internal multisend;
    address internal sender = makeAddr("sender");

    modifier onlyMonadFork() {
        if (block.chainid != MONAD_MAINNET) {
            console.log("SKIP: run with --fork-url $MONAD_MAINNET_RPC_URL");
            vm.skip(true);
        }
        _;
    }

    function setUp() public {
        multisend = new Multisend();
    }

    /// @dev Marginal cost per recipient, isolating fixed overhead by differencing
    /// two run sizes. `seed` keeps recipient addresses cold and distinct.
    function _marginalGas(address token, uint256 seed) internal returns (uint256) {
        uint256 g10 = _measure(token, 10, seed);
        uint256 g110 = _measure(token, 110, seed + 1_000_000);
        return (g110 - g10) / 100;
    }

    function _measure(address token, uint256 n, uint256 seed) internal returns (uint256 used) {
        bytes memory payload;
        for (uint256 i; i < n; ++i) {
            payload =
                bytes.concat(payload, abi.encodePacked(address(uint160(seed + i)), uint128(1)));
        }
        vm.prank(sender);
        uint256 before = gasleft();
        multisend.distribute(IERC20(token), payload);
        used = before - gasleft();
    }

    /// Baseline: Monad's raw opcode pricing via a plain OpenZeppelin ERC-20.
    function test_fork_gas_plainErc20() public onlyMonadFork {
        StandardToken token = new StandardToken();
        token.mint(sender, type(uint128).max);
        vm.prank(sender);
        token.approve(address(multisend), type(uint256).max);

        uint256 marginal = _marginalGas(address(token), 0x100000);
        console.log("MONAD marginal gas/recipient (plain ERC-20):", marginal);
        assertGt(marginal, 0);
    }

    /// Realistic: a real, heavier token. This is the number the floor must clear.
    function test_fork_gas_realUsdc() public onlyMonadFork {
        assertGt(
            MAINNET_USDC.code.length, 0, "no code at the USDC address - token registry is wrong"
        );

        deal(MAINNET_USDC, sender, type(uint96).max);
        vm.prank(sender);
        IERC20(MAINNET_USDC).approve(address(multisend), type(uint256).max);

        uint256 marginal = _marginalGas(MAINNET_USDC, 0x200000);
        console.log("MONAD marginal gas/recipient (real USDC):", marginal);
        console.log("");
        console.log("=> Set MIN_GAS_PER_TRANSFER above this, with margin.");
        console.log("   Recommended (2x real-token marginal):", marginal * 2);
        assertGt(marginal, 0);
    }

    /// The current placeholder must clear a real transfer. If this fails, the
    /// floor is starving legitimate payments — fix the constant, not the test.
    function test_fork_placeholderFloorIsNotTooLow() public onlyMonadFork {
        deal(MAINNET_USDC, sender, type(uint96).max);
        vm.prank(sender);
        IERC20(MAINNET_USDC).approve(address(multisend), type(uint256).max);

        uint256 marginal = _marginalGas(MAINNET_USDC, 0x300000);
        uint256 placeholder = 100_000; // mirrors Multisend.MIN_GAS_PER_TRANSFER

        console.log("placeholder floor:", placeholder);
        console.log("real marginal    :", marginal);
        assertGt(
            placeholder,
            marginal,
            "FLOOR TOO LOW: real transfers would be starved and mislabeled as failures"
        );
    }

    /// Sanity: a realistic payroll run fits one transaction on Monad.
    function test_fork_payrollScaleFitsOneTx() public onlyMonadFork {
        deal(MAINNET_USDC, sender, type(uint96).max);
        vm.prank(sender);
        IERC20(MAINNET_USDC).approve(address(multisend), type(uint256).max);

        uint256 g200 = _measure(MAINNET_USDC, 200, 0x400000);
        console.log("MONAD gas, 200 recipients (real USDC):", g200);
        console.log("=> derive the dashboard's default batch size from this");
        assertLt(g200, 150_000_000, "a 200-person payroll must fit one transaction");
    }
}
