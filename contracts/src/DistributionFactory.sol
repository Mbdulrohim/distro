// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Distribution } from "./Distribution.sol";

/// @title DistributionFactory
/// @notice Deploys `Distribution` escrow clones and holds protocol config.
///
/// @dev **The load-bearing boundary:** this contract configures the *system*
/// (fee, pausing new creation) but has **no path whatsoever to funds inside a
/// deployed `Distribution`**. The owner cannot seize, freeze, redirect, or
/// delay a funded run. Per-distribution isolation means a bug in one clone
/// cannot reach another's escrow either. That is provable in tests, and it is
/// the property the "not a custodian" claim rests on.
///
/// Owner must be a **Safe multisig**, never an EOA (CLAUDE.md, monskills
/// `wallet`). Unlike `Multisend` — which is ownerless, so its deployer holds no
/// power — this contract has real privileges and the rule applies in full.
contract DistributionFactory is Ownable {
    /// @notice Hard ceiling on the protocol fee: 1%.
    /// @dev A constant, not an owner-settable bound. An uncapped fee an owner
    /// can raise at will is a rug with extra steps — the ceiling is what makes
    /// "we can change the fee" survivable rather than a trust assumption. Fees
    /// are captured per-distribution at creation, so a change can never reach a
    /// distribution that already exists.
    uint16 public constant MAX_FEE_BPS = 100;

    /// @notice The implementation all clones delegate to. Immutable.
    address public immutable implementation;

    uint16 public protocolFeeBps;
    address public treasury;

    /// @notice Blocks creation of NEW distributions only.
    /// @dev It can never freeze, seize, or redirect a funded distribution —
    /// those stay executable and refundable regardless of this flag. A pause
    /// that could strand someone's payroll would be custody by another name.
    bool public paused;

    mapping(address creator => address[]) private _distributions;

    event DistributionCreated(
        address indexed distribution,
        address indexed creator,
        address indexed token,
        uint64 executeAfter,
        uint32 chunkCount
    );
    event FeeUpdated(uint16 feeBps, address treasury);
    event PausedSet(bool paused);

    error Paused();
    error FeeTooHigh();
    error TreasuryRequired();
    error NoChunks();

    constructor(address owner_, address treasury_) Ownable(owner_) {
        implementation = address(new Distribution(address(this)));
        treasury = treasury_;
        // Ships at zero. The mechanism exists from day one so monetization
        // never forces a re-audit; the rate is a later decision.
        protocolFeeBps = 0;
    }

    /// @notice Create a distribution escrow at a deterministic address.
    /// @param salt Client-supplied idempotency key.
    /// @dev CREATE2 on `(creator, salt)` **reverts on a duplicate**, which is
    /// the double-funding guard: a double-click, an RPC retry, or an impatient
    /// user on Monad's ~400ms blocks must not produce two payrolls. In a push
    /// model there is no clawback. Determinism is a bonus — the dashboard can
    /// show the escrow address before it exists.
    function createDistribution(address token, uint64 executeAfter, uint32 chunkCount, bytes32 salt)
        external
        returns (address distribution)
    {
        if (paused) revert Paused();
        if (chunkCount == 0) revert NoChunks();

        distribution = Clones.cloneDeterministic(implementation, _salt(msg.sender, salt));
        Distribution(distribution)
            .initialize(msg.sender, token, executeAfter, chunkCount, protocolFeeBps, treasury);
        _distributions[msg.sender].push(distribution);

        emit DistributionCreated(distribution, msg.sender, token, executeAfter, chunkCount);
    }

    /// @notice The address `createDistribution` would produce — before it exists.
    function predictAddress(address creator, bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _salt(creator, salt));
    }

    function distributionsOf(address creator) external view returns (address[] memory) {
        return _distributions[creator];
    }

    function distributionCount(address creator) external view returns (uint256) {
        return _distributions[creator].length;
    }

    /// @notice Set the protocol fee. Affects only distributions created after.
    function setFee(uint16 feeBps_, address treasury_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (feeBps_ > 0 && treasury_ == address(0)) revert TreasuryRequired();
        protocolFeeBps = feeBps_;
        treasury = treasury_;
        emit FeeUpdated(feeBps_, treasury_);
    }

    /// @notice Pause creation of new distributions. Emits loudly; no silent freezes.
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }

    function _salt(address creator, bytes32 salt) private pure returns (bytes32) {
        return keccak256(abi.encode(creator, salt));
    }
}
