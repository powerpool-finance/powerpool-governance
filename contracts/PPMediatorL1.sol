pragma solidity ^0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./PPMediatorCommon.sol";
import "./interfaces/IAMB.sol";
import "./interfaces/ICvp.sol";
import "./interfaces/IPPMediatorL1.sol";
import "./interfaces/IPPMediatorL2.sol";

/**
 * @title AMB Bridge Mediator Contract for Ethereum Mainnet (L1)
 * @author PowerPool
 */
contract PPMediatorL1 is IPPMediatorL1, PPMediatorL1V1Storage, PPMediatorCommon {
  using SafeMath for uint256;

  /// @notice Emitted when a CVP holder deposits their tokens to the mediator contract
  event Deposit(
    address indexed account,
    uint256 balanceBefore,
    uint256 balanceAfter,
    uint256 totalLockedBefore,
    uint256 totalLockedAfter
  );

  /// @notice Emitted when a CVP holder withdraws their tokens from the mediator contract
  event Withdrawal(
    address indexed account,
    uint256 balanceBefore,
    uint256 balanceAfter,
    uint256 totalLockedBefore,
    uint256 totalLockedAfter
  );

  /// @notice Emitted when a balance update message is sent to AMB
  event SendBalanceUpdates(bytes32 indexed msgId, address[] accounts, uint96[] balances);

  /// @notice Emitted when someone calls a permissionless sync balance method
  event SyncBalances(address indexed sender, uint256 accountsLength);

  /// @notice Emitted when AMB sends an incoming message about L2 voting decision
  event HandleVotingDecision(bytes32 indexed msgId, bytes4 signature, bytes args);

  /// @notice Emitted when the owner sets a new governor address
  event SetGovernor(address indexed governor);

  /**
   * @notice Initializes a proxied version of the contract
   * @param _owner The initial contract owner address
   * @param _governor The initial governorL1 contract address
   * @param _cvpToken The CVP token address
   * @param _amb The initial Arbitrary Message Bridge address
   * @param _mediatorContractOnOtherSide The initial mediatorL2 contract address
   * @param _requestGasLimit The initial request gas limit value
   */
  function initialize(
    address _owner,
    address _governor,
    address _cvpToken,
    address _amb,
    address _mediatorContractOnOtherSide,
    uint256 _requestGasLimit
  ) external initializer {
    require(_cvpToken != address(0), "PPMediatorL1:initialize: Invalid _cvpToken address");
    require(_governor != address(0), "PPMediatorL1:initialize: Invalid _governor address");

    cvpToken = _cvpToken;
    governor = _governor;
    PPMediatorCommon.initialize(_owner, _amb, _mediatorContractOnOtherSide, _requestGasLimit);
  }

  /**
   * @notice Accepts and stores CVP tokens, sends a balance update message to the mediatorL2
   * @param _amount of CVP to deposit
   */
  function deposit(uint256 _amount) external {
    require(_amount > 0, "PPMediatorL1:deposit: Amount should be positive");
    safe96(_amount, "PPMediatorL1::deposit: amount exceeds 96 bits");

    address msgSender = msg.sender;

    uint256 cvpLockedBefore = cvpLocked[msgSender];
    uint256 totalCvpLockedBefore = totalCvpLocked;

    // uint256 cvpLockedAfter = cvpLockedBefore + _amount;
    uint256 cvpLockedAfter = cvpLockedBefore.add(_amount);

    // totalCvpLocked += _amount;
    uint256 totalCvpLockedAfter = totalCvpLocked.add(_amount);

    totalCvpLocked = totalCvpLockedAfter;
    cvpLocked[msgSender] = cvpLockedAfter;

    emit Deposit(msgSender, cvpLockedBefore, cvpLockedAfter, totalCvpLockedBefore, totalCvpLockedAfter);

    IERC20(cvpToken).transferFrom(msgSender, address(this), _amount);
    _sendBalanceUpdate(msgSender, cvpLockedAfter);
  }

  /**
   * @notice Transfers CVP tokens back to the holder, sends a balance update message to the mediatorL2
   * @param _to The address to send the unlocked CVP tokens to
   * @param _amount The amount of CVP to withdraw
   */
  function withdraw(address _to, uint256 _amount) external {
    require(_amount > 0, "PPMediatorL1:withdraw: Amount should be positive");
    safe96(_amount, "PPMediatorL1::withdraw: amount exceeds 96 bits");
    require(_to != address(0) && _to != address(this), "PPMediatorL1:withdraw: Can't withdraw to 0 or self");

    address msgSender = msg.sender;
    uint256 cvpLockedBefore = cvpLocked[msgSender];
    uint256 totalCvpLockedBefore = totalCvpLocked;

    require(
      cvpLockedBefore >= _amount && totalCvpLockedBefore >= _amount,
      "PPMediatorL1:deposit: Can't withdraw more than locked"
    );

    uint256 cvpLockedAfter = cvpLockedBefore - _amount;
    uint256 totalCvpLockedAfter = totalCvpLocked - _amount;

    totalCvpLocked = totalCvpLockedAfter;
    cvpLocked[msgSender] = cvpLockedAfter;

    emit Withdrawal(msgSender, cvpLockedBefore, cvpLockedAfter, totalCvpLockedBefore, totalCvpLockedAfter);

    IERC20(cvpToken).transfer(_to, _amount);
    _sendBalanceUpdate(msgSender, cvpLockedAfter);
  }

  /**
   * @notice Sends balance update message for the given accounts to the mediatorL2
   * @dev Permissioness method, anyone can execute it
   * @param _accounts The array of the accounts to send a balance update messages for
   */
  function syncBalances(address[] calldata _accounts) external {
    uint256 len = _accounts.length;
    require(len > 0, "PPMediatorL1:deposit: Empty accounts array");

    uint96[] memory balances = new uint96[](len);

    for (uint256 i = 0; i < len; i++) {
      balances[i] = safe96(cvpLocked[_accounts[i]], "PPMediatorL1::syncBalances: amount exceeds 96 bits");
    }

    emit SyncBalances(msg.sender, len);
    _sendBalanceUpdates(_accounts, balances);
  }

  /*** Balance Updates L1 -> L2 (outgoing) ***/

  function _sendBalanceUpdate(address _account, uint256 _balance) internal {
    address[] memory addresses = new address[](1);
    uint96[] memory balances = new uint96[](1);

    addresses[0] = _account;
    balances[0] = safe96(_balance, "PPMediatorL1::_sendBalanceUpdate: amount exceeds 96 bits");

    _sendBalanceUpdates(addresses, balances);
  }

  function _sendBalanceUpdates(address[] memory _accounts, uint96[] memory _balances) internal {
    bytes4 methodSelector = IPPMediatorL2(address(0)).handleBalanceUpdates.selector;
    bytes memory data = abi.encodeWithSelector(methodSelector, _accounts, _balances);

    bytes32 msgId = amb.requireToPassMessage(mediatorContractOnOtherSide, data, requestGasLimit);

    emit SendBalanceUpdates(msgId, _accounts, _balances);
  }

  // The exact copy copy from CVP token
  function safe96(uint256 n, string memory errorMessage) internal pure returns (uint96) {
    require(n < 2**96, errorMessage);
    return uint96(n);
  }

  /*** Voting Decisions L1 <- L2 (incoming) ***/

  /**
   * @notice Handles a voting decision from the governorL2 contract.
   * @dev A signature is accepted as a separate parameter in order to make filter check more explicit.
   * @param _signature The signature of a method to execute. The `propose()` and `castVote()` methods
   *         of the governorL1 contract are allowed only.
   * @param _args The ABI-encoded argument list for the corresponding `_signature` argument
   */
  function handleCallGovernorL1(bytes4 _signature, bytes calldata _args) external {
    require(msg.sender == address(amb), "PPMediatorL1::handleBalanceUpdate: Only AMB allowed");
    require(
      amb.messageSender() == mediatorContractOnOtherSide,
      "PPMediatorL1::handleBalanceUpdate: Invalid message sender"
    );

    require(
      // _signature == "propose(address[],uint256[],string[],bytes[],string)" || _signature == "castVote(uint256,bool)"
      _signature == 0xda95691a || _signature == 0x15373e3d,
      "PPMediatorL1:handleVotingDecision: Unsupported signature"
    );

    (bool success, ) = governor.call(abi.encodePacked(_signature, _args));
    require(success, "PPMediatorL1::handleVotingDecision: tx execution reverted");

    bytes32 msgId = amb.messageId();
    emit HandleVotingDecision(msgId, _signature, _args);
  }

  /*** Owner methods ***/

  /**
   * @notice Sets a new governorL1 address
   * @param _governor A new governorL1 address
   */
  function setGovernor(address _governor) external onlyOwner {
    governor = _governor;
    emit SetGovernor(_governor);
  }

  /**
   * @notice Self-delegates votes in the CVP token
   * @dev To be executed once
   */
  function setDelegatee() external onlyOwner {
    ICvp(cvpToken).delegate(address(this));
  }
}
