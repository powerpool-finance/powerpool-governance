pragma solidity ^0.5.16;

interface ICvp {
  function getPriorVotes(address _account, uint256 _blockNumber) external view returns (uint96);

  function delegate(address _delegatee) external;
}
