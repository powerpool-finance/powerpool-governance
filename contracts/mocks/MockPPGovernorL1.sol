pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../PPGovernorL1.sol";

contract MockPPGovernorL1 is PPGovernorL1 {
  constructor(
    address timelock_,
    address[] memory voteSources_,
    address guardian_
  ) public PPGovernorL1(timelock_, voteSources_, guardian_) {}

  function votingPeriod() public pure returns (uint256) {
    return 15;
  } // 15 blocks
}
