pragma solidity ^0.5.16;

import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IAMB.sol";

contract PPMediatorCommonStorage is Ownable, Initializable {
  IAMB public amb;
  address public mediatorContractOnOtherSide;
  uint256 public requestGasLimit;
}

contract PPMediatorL1V1Storage is PPMediatorCommonStorage {
  address public cvpToken;
  address public governor;
  uint256 public totalCvpLocked;

  mapping(address => uint256) public cvpLocked;
}

contract PPMediatorL2V1Storage is PPMediatorCommonStorage {
  /// @notice A checkpoint for marking number of votes from a given block
  struct Checkpoint {
    uint32 fromBlock;
    uint96 votes;
  }

  address public governorL2Timelock;

  /// @notice A record of unclaimed balance checkpoints for each member, by index
  mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

  /// @notice The number of checkpoints for each member
  mapping(address => uint32) public numCheckpoints;
}
