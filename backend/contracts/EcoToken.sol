// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EcoToken: Campus Carbon Token (CCT)
 * @notice ERC-20 reward token for verified eco-actions. Whole tokens only (0 decimals),
 *         so 1 CCT = 1 eco point. Only the EcoLedger backend (the owner) can mint.
 */
contract EcoToken is ERC20, Ownable {
    /// @notice Emitted for every approved activity, linking the mint to its MongoDB record.
    event EcoReward(address indexed student, uint256 amount, string activityId);

    constructor() ERC20("Campus Carbon Token", "CCT") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Plain mint, kept for scripts and tests.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Mint the reward for one approved activity and record which activity it was for.
    function reward(address to, uint256 amount, string calldata activityId) external onlyOwner {
        require(amount > 0, "Amount must be positive");
        _mint(to, amount);
        emit EcoReward(to, amount, activityId);
    }
}
