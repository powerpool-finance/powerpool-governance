pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "../PPGovernorL2.sol";

contract MockPPGovernorL2 is PPGovernorL2 {
  constructor(
    address timelock_,
    address[] memory voteSources_,
    address guardian_
  ) public PPGovernorL2(timelock_, voteSources_, guardian_) {}

  function votingPeriod() public pure returns (uint256) {
    return 5;
  } // 5 blocks to make rewind faster
}
