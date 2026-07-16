// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title PayloadLib
/// @notice The canonical recipient-payload encoding, shared by every contract
/// that speaks it.
///
/// @dev **This is the single source of truth for the encoding.** docs/CONTRACT_SPEC.md
/// requires one normative format used identically by the commitment, the
/// emitted event, and execution calldata — because offchain generation and
/// onchain verification drifting apart produces a distribution that hashes
/// wrong and can never execute. One implementation is the only way to
/// guarantee that; two copies would be a divergence waiting to happen.
///
/// ```
/// payload = entry ‖ entry ‖ …
/// entry   = abi.encodePacked(address recipient, uint128 amount)   // 20 + 16 = 36 bytes
/// ```
///
/// `uint128` caps a single payment at ~3.4e38 base units (~3.4e20 tokens at 18
/// decimals) — headroom for any real token, including high-supply ones where
/// `uint96` would overflow.
library PayloadLib {
    /// @notice Bytes per entry: 20 (address) + 16 (uint128).
    uint256 internal constant ENTRY_SIZE = 36;

    /// @notice Payload length is not a whole number of entries.
    error InvalidPayloadLength();
    /// @notice Payload contains no entries.
    error EmptyPayload();

    /// @notice Number of entries, reverting on a malformed payload.
    function count(bytes calldata payload) internal pure returns (uint256) {
        if (payload.length == 0) revert EmptyPayload();
        if (payload.length % ENTRY_SIZE != 0) revert InvalidPayloadLength();
        return payload.length / ENTRY_SIZE;
    }

    /// @notice Decode entry `index`. Layout: [0:20] recipient, [20:36] amount.
    /// @dev The amount load reads a full word starting at ptr+20, which runs
    /// past the entry (and, for the final entry, past the payload). The shift
    /// discards those bytes, so the read is safe and the value exact.
    function entryAt(bytes calldata payload, uint256 index)
        internal
        pure
        returns (address recipient, uint256 amount)
    {
        assembly {
            let ptr := add(payload.offset, mul(index, ENTRY_SIZE))
            recipient := shr(96, calldataload(ptr))
            amount := shr(128, calldataload(add(ptr, 20)))
        }
    }

    /// @notice The commitment hash for a chunk.
    /// @dev Binds the distribution address and chunk index, so a payload can
    /// never be replayed against a different chunk or a different contract.
    /// `abi.encode`, never `encodePacked`: packed encoding of dynamic data is
    /// ambiguous and collision-prone.
    function commitmentHash(address distribution, uint256 chunkIndex, bytes calldata payload)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(distribution, chunkIndex, payload));
    }
}
