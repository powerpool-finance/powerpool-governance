pragma solidity ^0.5.16;

import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IAMB.sol";
import "./PPMediatorStorage.sol";

/**
 * @title AMB Bridge Mediator Common Contract
 * @author PowerPool
 */
contract PPMediatorCommon is Ownable, Initializable, PPMediatorCommonStorage {
  /// @notice Emitted when the owner sets a new mediatorContractOnOtherSide address
  event SetMediatorContractOnOtherSide(address indexed mediatorContractOnOtherSide);

  /// @notice Emitted when the owner sets a new AMB address
  event SetAmb(address indexed amb);

  /// @notice Emitted when the owner sets a new requestGasLimit value
  event SetRequestGasLimit(uint256 requestGasLimit);

  /**
   * @notice Initializes a proxied version of the contract
   * @dev Should be called by an implementation contract
   * @param _owner The initial contract owner address
   * @param _amb The initial Arbitrary Message Bridge address
   * @param _mediatorContractOnOtherSide The initial mediator contract address
   * @param _requestGasLimit The initial request gas limit value
   */
  function initialize(
    address _owner,
    address _amb,
    address _mediatorContractOnOtherSide,
    uint256 _requestGasLimit
  ) internal initializer {
    require(_owner != address(0), "PPMediatorCommon:initialize: Invalid _owner address");
    require(_amb != address(0), "PPMediatorCommon:initialize: Invalid _amb address");
    require(_requestGasLimit > 0, "PPMediatorCommon:initialize: Invalid _requestGasLimit value");

    _transferOwnership(_owner);
    amb = IAMB(_amb);
    mediatorContractOnOtherSide = _mediatorContractOnOtherSide;
    requestGasLimit = _requestGasLimit;
  }

  /*** Owner methods ***/

  /**
   * @notice Sets a new mediatorContractOnOtherSide address
   * @param _governor A new mediatorContractOnOtherSide address
   */
  function setMediatorContractOnOtherSide(address _mediatorContractOnOtherSide) external onlyOwner {
    mediatorContractOnOtherSide = _mediatorContractOnOtherSide;
    emit SetMediatorContractOnOtherSide(_mediatorContractOnOtherSide);
  }

  /**
   * @notice Sets a new Arbitrary Message Bridge address
   * @param _governor A new AMB address
   */
  function setAmb(address _amb) external onlyOwner {
    amb = IAMB(_amb);
    emit SetAmb(_amb);
  }

  /**
   * @notice Sets a new requestGasLimit value
   * @param _governor A new requestGasLimit value
   */
  function setRequestGasLimit(uint256 _requestGasLimit) external onlyOwner {
    requestGasLimit = _requestGasLimit;
    emit SetRequestGasLimit(_requestGasLimit);
  }
}
