pragma solidity ^0.5.16;

import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IAMB.sol";

contract PPMediatorCommonStorage is Ownable, Initializable {
  /// @notice The Arbitrary Message Bridge address
  IAMB public amb;

  /// @notice The mediator deployed on the opposite chain
  address public mediatorContractOnOtherSide;

  /// @notice A maximum amount of gas to spend on an AMB message call
  uint256 public requestGasLimit;
}

contract PPMediatorL1V1Storage is PPMediatorCommonStorage {
  /// @notice The CVP token address
  address public cvpToken;

  /// @notice The governor address will receive incoming vote decisions from L2
  address public governor;

  /// @notice The total locked CVP value
  uint256 public totalCvpLocked;

  /// @notice A locked CVP value by a holder
  mapping(address => uint256) public cvpLocked;
}

contract PPMediatorL2V1Storage is PPMediatorCommonStorage {
  /// @notice A checkpoint for marking number of locked CVP tokens from a given block
  struct Checkpoint {
    uint32 fromBlock;
    uint96 votes;
  }

  /// @notice The timelock used by the governorL2 contract
  address public governorL2Timelock;

  /// @notice A record of unclaimed balance checkpoints for each CVP holder, by index
  mapping(address => mapping(uint32 => Checkpoint)) public checkpoints;

  /// @notice The number of checkpoints for each CVP holder
  mapping(address => uint32) public numCheckpoints;
}
