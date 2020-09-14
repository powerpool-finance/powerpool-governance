pragma solidity ^0.5.16;

interface IPPMediatorL2 {
  function getPriorVotes(address account, uint256 blockNumber) external view returns (uint96);

  function handleBalanceUpdates(address[] calldata _accounts, uint96[] calldata _balances) external;
}
