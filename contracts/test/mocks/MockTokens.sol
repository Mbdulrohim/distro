// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Standard, well-behaved ERC-20.
contract StandardToken is ERC20 {
    constructor() ERC20("Standard", "STD") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev USDT-class token whose `transfer`/`transferFrom` return **nothing**.
/// A naive `IERC20.transferFrom` call reverts decoding the empty return value,
/// which would make every payment in this token look like a rejection.
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    // Deliberately no `returns (bool)`.
    function transferFrom(address from, address to, uint256 amount) external {
        require(balanceOf[from] >= amount, "balance");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

/// @dev Returns `false` rather than reverting on failure. Silently loses funds
/// for any integration that ignores the return value.
contract FalseReturnToken is ERC20 {
    bool public failNext;

    constructor() ERC20("FalseReturn", "FLS") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailNext(bool v) external {
        failNext = v;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (failNext) return false;
        return super.transferFrom(from, to, amount);
    }
}

/// @dev USDC-class blocklist: reverts for specific recipients. The canonical
/// reason one payroll entry must not revert the whole run.
contract BlocklistToken is ERC20 {
    mapping(address => bool) public blocked;

    constructor() ERC20("Blocklist", "BLK") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBlocked(address who, bool v) external {
        blocked[who] = v;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(!blocked[to], "recipient blocked");
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Returns a garbage-shaped value (not empty, not 32 bytes).
contract WeirdReturnToken {
    function approve(address, uint256) external pure { }

    function transferFrom(address, address, uint256) external pure returns (bytes memory) {
        return "garbage";
    }
}

/// @dev Attempts to reenter `distribute` during a transfer.
contract ReentrantToken is ERC20 {
    address public target;
    bytes public payload;
    bool private attacked;

    /// @notice True once the reentrant call has actually been made.
    /// @dev Without this the reentrancy test could pass vacuously — "the attack
    /// didn't pay out" is also true when the attack never fired.
    bool public reentryAttempted;
    /// @notice Whether the reentrant call succeeded. Must be false.
    bool public reentrySucceeded;

    constructor() ERC20("Reentrant", "RNT") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setAttack(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (target != address(0) && !attacked) {
            attacked = true;
            reentryAttempted = true;
            // Re-enter. Must be rejected by the reentrancy guard; the low-level
            // call swallows the revert so the outer transfer still reports honestly.
            (bool ok,) = target.call(payload);
            reentrySucceeded = ok;
        }
        return super.transferFrom(from, to, amount);
    }
}

/// @dev Consumes every unit of gas forwarded to it, exactly as a real
/// out-of-gas sub-call would. Used to prove the gas floor produces a clean
/// revert rather than silently recording healthy recipients as failed.
contract GasBurnerToken is ERC20 {
    constructor() ERC20("GasBurner", "GAS") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transferFrom(address, address, uint256) public pure override returns (bool) {
        // `invalid` consumes all remaining gas — the precise condition the floor exists to detect.
        assembly {
            invalid()
        }
    }
}
