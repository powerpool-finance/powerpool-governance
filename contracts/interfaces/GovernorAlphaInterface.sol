pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./CvpInterface.sol";

contract GovernorAlphaInterface {
  /// @notice The name of this contract
  function name() external view returns (string memory);

  /// @notice The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed
  function quorumVotes() external pure returns (uint);

  /// @notice The number of votes required in order for a voter to become a proposer
  function proposalThreshold() external pure returns (uint);

  /// @notice The maximum number of actions that can be included in a proposal
  function proposalMaxOperations() external pure returns (uint);

  /// @notice The delay before voting on a proposal may take place, once proposed
  function votingDelay() external pure returns (uint);

  /// @notice The duration of voting on a proposal, in blocks
  function votingPeriod() external pure returns (uint);

  /// @notice The address of the PowerPool Protocol Timelock
  function timelock() external view returns (TimelockInterface);

  /// @notice The address of the Governor Guardian
  function guardian() external view returns (address);

  /// @notice The total number of proposals
  function proposalCount() external view returns (uint);

  /// @notice The official record of all proposals ever proposed
  function proposals(uint _id) external view returns (
    uint id,
    address proposer,
    uint eta,
    uint startBlock,
    uint endBlock,
    uint forVotes,
    uint againstVotes,
    bool canceled,
    bool executed
  );

  enum ProposalState {
    Pending,
    Active,
    Canceled,
    Defeated,
    Succeeded,
    Queued,
    Expired,
    Executed
  }

  /// @notice Ballot receipt record for a voter
  struct Receipt {
    /// @notice Whether or not a vote has been cast
    bool hasVoted;

    /// @notice Whether or not the voter supports the proposal
    bool support;

    /// @notice The number of votes the voter had, which were cast
    uint256 votes;
  }

  /// @notice The latest proposal for each proposer
  function latestProposalIds(address _addr) external view returns (uint);

  /// @notice The EIP-712 typehash for the contract's domain
  function DOMAIN_TYPEHASH() external view returns (bytes32);

  /// @notice The EIP-712 typehash for the ballot struct used by the contract
  function BALLOT_TYPEHASH() external view returns (bytes32);

  /// @notice An event emitted when a new proposal is created
  event ProposalCreated(uint indexed id, address indexed proposer, address[] targets, uint[] values, string[] signatures, bytes[] calldatas, uint startBlock, uint endBlock, string description);

  /// @notice An event emitted when a vote has been cast on a proposal
  event VoteCast(address indexed voter, uint indexed proposalId, bool indexed support, uint votes);

  /// @notice An event emitted when a proposal has been canceled
  event ProposalCanceled(uint id);

  /// @notice An event emitted when a proposal has been queued in the Timelock
  event ProposalQueued(uint id, uint eta);

  /// @notice An event emitted when a proposal has been executed in the Timelock
  event ProposalExecuted(uint id);

  /// @notice An event emitted when a change vote sources proposal has been executed
  event SetVoteSources(address[] voteSources);

  function propose(address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint);

  function queue(uint proposalId) public;

  function execute(uint proposalId) public payable;

  function cancel(uint proposalId) public;

  function getActions(uint proposalId) public view returns (address[] memory targets, uint[] memory values, string[] memory signatures, bytes[] memory calldatas);

  function getReceipt(uint proposalId, address voter) public view returns (Receipt memory);

  function getVoteSources() external view returns (address[] memory);

  function state(uint proposalId) public view returns (ProposalState);

  function castVote(uint proposalId, bool support) public;

  function castVoteBySig(uint proposalId, bool support, uint8 v, bytes32 r, bytes32 s) public;

  function __acceptAdmin() public;

  function __abdicate() public ;

  function __queueSetTimelockPendingAdmin(address newPendingAdmin, uint eta) public;

  function __executeSetTimelockPendingAdmin(address newPendingAdmin, uint eta) public;
}

interface TimelockInterface {
  function delay() external view returns (uint);
  function GRACE_PERIOD() external view returns (uint);
  function acceptAdmin() external;
  function queuedTransactions(bytes32 hash) external view returns (bool);
  function queueTransaction(address target, uint value, string calldata signature, bytes calldata data, uint eta) external returns (bytes32);
  function cancelTransaction(address target, uint value, string calldata signature, bytes calldata data, uint eta) external;
  function executeTransaction(address target, uint value, string calldata signature, bytes calldata data, uint eta) external payable returns (bytes memory);
}
