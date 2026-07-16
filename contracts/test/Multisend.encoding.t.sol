// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Multisend } from "../src/Multisend.sol";
import { StandardToken } from "./mocks/MockTokens.sol";

/// @notice Cross-language encoding parity with the frontend.
///
/// @dev The frontend builds distribution payloads in TypeScript
/// (web/src/lib/recipients/encode.ts). The contract decodes them here. A
/// one-byte divergence yields a payload the contract silently misreads, so the
/// SAME fixture — address `0x1111…1111`, amount `1e18`, and the exact expected
/// 36-byte encoding — is asserted on both sides:
///
///   web/src/lib/recipients/recipients.test.ts  (FIXTURE_ENTRY_HEX)
///   this file                                    (FIXTURE_ENTRY)
///
/// Change the encoding on either side and one of these two suites fails.
contract MultisendEncodingTest is Test {
    address internal constant FIXTURE_ADDRESS = 0x1111111111111111111111111111111111111111;
    uint128 internal constant FIXTURE_AMOUNT = 1e18;

    /// The canonical bytes the TS encoder must also produce, verbatim.
    bytes internal constant FIXTURE_ENTRY =
        hex"111111111111111111111111111111111111111100000000000000000de0b6b3a7640000";

    Multisend internal multisend;
    StandardToken internal token;
    address internal sender = makeAddr("sender");

    function setUp() public {
        multisend = new Multisend();
        token = new StandardToken();
        token.mint(sender, 1000 ether);
        vm.prank(sender);
        token.approve(address(multisend), type(uint256).max);
    }

    /// The on-chain packed encoding equals the shared fixture literal.
    function test_encoding_matchesSharedFixture() public pure {
        bytes memory encoded = abi.encodePacked(FIXTURE_ADDRESS, FIXTURE_AMOUNT);
        assertEq(encoded, FIXTURE_ENTRY, "packed encoding drifted from the frontend fixture");
        assertEq(encoded.length, 36, "one entry must be exactly 36 bytes");
    }

    /// Distributing the fixture payload pays the fixture recipient the fixture
    /// amount at index 0 — proving the decoder reads what the encoder wrote.
    function test_encoding_fixturePayloadDecodesAndPays() public {
        vm.prank(sender);
        (uint256 totalPaid, uint256 paidCount,) =
            multisend.distribute(IERC20(address(token)), FIXTURE_ENTRY);

        assertEq(paidCount, 1);
        assertEq(totalPaid, FIXTURE_AMOUNT);
        assertEq(token.balanceOf(FIXTURE_ADDRESS), FIXTURE_AMOUNT, "decoded recipient/amount wrong");
    }
}
