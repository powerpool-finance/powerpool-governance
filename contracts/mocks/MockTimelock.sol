pragma solidity ^0.5.16;

import "../Timelock.sol";

contract MockTimelock is Timelock {
  constructor(address admin_, uint256 delay_) public Timelock(admin_, delay_) {}

  function forceAdmin(address _admin) external {
    admin = _admin;
    pendingAdmin = address(0);
  }
}
