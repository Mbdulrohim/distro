// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script, console } from "forge-std/Script.sol";
import { MultisendNative } from "../src/MultisendNative.sol";

/// @notice Deploys `MultisendNative`.
///
/// @dev Same reasoning as script/DeployMultisend.s.sol: no owner, no admin,
/// no privileged role whatsoever (see src/MultisendNative.sol). The deployer
/// gains nothing, so who broadcasts this is not a security property — a
/// plain EOA (the agent wallet) is acceptable, same as Multisend's own
/// deployment.
///
/// Usage:
///   forge script script/DeployMultisendNative.s.sol:DeployMultisendNative \
///     --rpc-url $MONAD_MAINNET_RPC_URL --broadcast -vvv
contract DeployMultisendNative is Script {
    function run() external returns (MultisendNative multisendNative) {
        vm.startBroadcast();
        multisendNative = new MultisendNative();
        vm.stopBroadcast();

        console.log("=======================================");
        console.log("MultisendNative deployed");
        console.log("  chain id:", block.chainid);
        console.log("  address :", address(multisendNative));
        console.log("=======================================");
        console.log("Record this in contracts/deployments/ and web/src/config/contracts.ts");
    }
}
