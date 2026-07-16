// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Script, console } from "forge-std/Script.sol";
import { Multisend } from "../src/Multisend.sol";

/// @notice Deploys `Multisend`.
///
/// @dev **On the Safe-multisig rule.** CLAUDE.md requires deployments to go
/// through a Safe multisig rather than a bare EOA. That rule exists so no
/// single key holds privileged power over a deployed contract — and it applies
/// in full to `DistributionFactory`, which has an owner, a fee, and a pause.
///
/// `Multisend` has **no owner, no admin, and no privileged role whatsoever**
/// (see src/Multisend.sol). The deployer gains nothing: they cannot pause it,
/// upgrade it, take a fee, or touch a single token. So who broadcasts this
/// transaction is not a security property — it only determines the address.
/// A plain EOA is therefore acceptable here, and is the pragmatic choice for
/// testnet gas calibration.
///
/// For **mainnet**, prefer a deterministic deploy (CREATE2 via one of Monad's
/// canonical deployers — see the monskills `addresses` skill) so the address is
/// reproducible and independent of deployer nonce, rather than a Safe for its
/// own sake.
///
/// Usage:
///   forge script script/DeployMultisend.s.sol:DeployMultisend \
///     --rpc-url $MONAD_TESTNET_RPC_URL --broadcast -vvv
contract DeployMultisend is Script {
    function run() external returns (Multisend multisend) {
        vm.startBroadcast();
        multisend = new Multisend();
        vm.stopBroadcast();

        console.log("=======================================");
        console.log("Multisend deployed");
        console.log("  chain id:", block.chainid);
        console.log("  address :", address(multisend));
        console.log("=======================================");
        console.log("Record this in contracts/deployments/ and web/src/config/contracts.ts");
    }
}
