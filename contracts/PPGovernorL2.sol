pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./PPGovernorL1.sol";

contract PPGovernorL2 is PPGovernorL1 {
  /// @notice The name of this contract
  // solhint-disable const-name-snakecase
  string public constant name = "PowerPool Governor L2";

  /// @notice The duration of voting on a proposal, in blocks
  function votingPeriod() public pure returns (uint256) {
    return 34560;
  } // ~2 days in blocks (assuming 5s blocks)

  constructor(
    address timelock_,
    address[] memory voteSources_,
    address guardian_
  ) public PPGovernorL1(timelock_, voteSources_, guardian_) {}
}
