pragma solidity ^0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./interfaces/IAMB.sol";
import "./interfaces/IPPMediatorL1.sol";
import "./interfaces/IPPMediatorL2.sol";
import "./PPMediatorCommon.sol";

/**
 * @title AMB Bridge Mediator Contract for a Side Chain (L2)
 * @author PowerPool
 */
contract PPMediatorL2 is IPPMediatorL2, PPMediatorL2V1Storage, PPMediatorCommon {
  using SafeMath for uint256;

  /// @notice Emitted for each CVP holder balance update
  event UpdateBalance(address indexed account, bytes32 indexed msgId, uint96 balanceBefore, uint96 _balanceAfter);

  /// @notice Emitted once when a corresponding AMB message is received
  event HandleBalanceUpdates(bytes32 indexed msgId, address[] accounts, uint96[] balances);

  /// @notice Emitted when the governorL2 executes a `propose/castVote in L1` proposal
  event SendVotingDecision(bytes32 indexed msgId, bytes4 signature, bytes args);

  /// @notice Emitted when the owner changes governorL2's timelock address
  event SetGovernorL2Timelock(address indexed governorL2Timelock);

  /**
   * @notice Initializes a proxied version of the contract
   * @param _owner The initial contract owner address
   * @param _governorL2Timelock The initial governorL2's timelock contract address
   * @param _amb The initial Arbitrary Message Bridge address
   * @param _mediatorContractOnOtherSide The initial mediatorL2 contract address
   * @param _requestGasLimit The initial request gas limit value
   */
  function initialize(
    address _owner,
    address _governorL2Timelock,
    address _amb,
    address _mediatorContractOnOtherSide,
    uint256 _requestGasLimit
  ) external {
    require(_governorL2Timelock != address(0), "PPMediatorL2:initialize: Invalid _governorL2Timelock address");

    governorL2Timelock = _governorL2Timelock;

    PPMediatorCommon.initialize(_owner, _amb, _mediatorContractOnOtherSide, _requestGasLimit);
  }

  /*** Voting Decisions L2 -> L1 (outgoing) ***/

  /**
   * @notice Relays governorL2 decision to AMB
   * @dev The mediatorL1 will check the signature to allow the `propose()` and `castVote()` methods only
   * @param _signature The signature of a method to execute
   * @param _args The ABI-encoded argument list for the corresponding `_signature` argument
   */
  function callGovernorL1(bytes4 _signature, bytes calldata _args) external {
    require(msg.sender == governorL2Timelock, "PPMediatorL2:callGovernorL1: Only governorL2Timelock allowed");

    bytes4 methodSelector = IPPMediatorL1(address(0)).handleCallGovernorL1.selector;
    bytes memory data = abi.encodeWithSelector(methodSelector, _signature, _args);
    bytes32 msgId = amb.requireToPassMessage(mediatorContractOnOtherSide, data, requestGasLimit);

    emit SendVotingDecision(msgId, _signature, _args);
  }

  /*** Balance Updates L2 <- L1 (incoming) ***/

  /**
   * @notice Handles a balance updates from the governorL1 contract
   * @param _accounts A list of accounts to update
   * @param _balances A corresponding list of balances to update
   */
  function handleBalanceUpdates(address[] calldata _accounts, uint96[] calldata _balances) external {
    require(msg.sender == address(amb), "PPMediatorL2::handleBalanceUpdates: Only AMB allowed");
    require(
      amb.messageSender() == mediatorContractOnOtherSide,
      "PPMediatorL2::handleBalanceUpdates: Invalid message sender"
    );

    uint256 len = _accounts.length;
    require(len == _balances.length, "PPMediatorL2::handleBalanceUpdates: Array lengths should match");

    bytes32 msgId = amb.messageId();

    for (uint256 i = 0; i < len; i++) {
      _updateBalance(msgId, _accounts[i], _balances[i]);
    }

    emit HandleBalanceUpdates(msgId, _accounts, _balances);
  }

  function _updateBalance(
    bytes32 _msgId,
    address _account,
    uint96 _balanceAfter
  ) internal {
    uint32 nextCheckpoint = numCheckpoints[_account];
    uint96 balanceBefore = nextCheckpoint > 0 ? checkpoints[_account][nextCheckpoint - 1].votes : 0;

    _writeCheckpoint(_account, nextCheckpoint, _balanceAfter);

    emit UpdateBalance(_account, _msgId, balanceBefore, _balanceAfter);
  }

  /// @dev A copy from CVP token; Only the event and oldVotes arg were removed
  function _writeCheckpoint(
    address delegatee,
    uint32 nCheckpoints,
    uint96 newVotes
  ) internal {
    uint32 blockNumber = safe32(block.number, "PPMediatorL2::_writeCheckpoint: Block number exceeds 32 bits");

    if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
      checkpoints[delegatee][nCheckpoints - 1].votes = newVotes;
    } else {
      checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
      numCheckpoints[delegatee] = nCheckpoints + 1;
    }
  }

  function getCurrentVotes(address account) external view returns (uint96) {
    uint32 nCheckpoints = numCheckpoints[account];
    return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].votes : 0;
  }

  /**
   * @notice Determine the prior number of votes for an account as of a block number
   * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
   * @param account The address of the account to check
   * @param blockNumber The block number to get the vote balance at
   * @return The number of votes the account had as of the given block
   */
  function getPriorVotes(address account, uint256 blockNumber) public view returns (uint96) {
    require(blockNumber < block.number, "PPMediatorL2::getPriorVotes: not yet determined");

    uint32 nCheckpoints = numCheckpoints[account];
    if (nCheckpoints == 0) {
      return 0;
    }

    // First check most recent balance
    if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
      return checkpoints[account][nCheckpoints - 1].votes;
    }

    // Next check implicit zero balance
    if (checkpoints[account][0].fromBlock > blockNumber) {
      return 0;
    }

    uint32 lower = 0;
    uint32 upper = nCheckpoints - 1;
    while (upper > lower) {
      uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
      Checkpoint memory cp = checkpoints[account][center];
      if (cp.fromBlock == blockNumber) {
        return cp.votes;
      } else if (cp.fromBlock < blockNumber) {
        lower = center;
      } else {
        upper = center - 1;
      }
    }
    return checkpoints[account][lower].votes;
  }

  /// @dev The exact copy from CVP token
  function safe32(uint256 n, string memory errorMessage) internal pure returns (uint32) {
    require(n < 2**32, errorMessage);
    return uint32(n);
  }

  /*** Owner methods ***/

  /**
   * @notice Sets a new governorL2's timelock address
   * @param _governor A new governorL2's timelock address
   */
  function setGovernorL2Timelock(address _governorL2Timelock) external onlyOwner {
    governorL2Timelock = _governorL2Timelock;
    emit SetGovernorL2Timelock(_governorL2Timelock);
  }
}
