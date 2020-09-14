pragma solidity ^0.5.16;

import "@openzeppelin/upgrades-core/contracts/Initializable.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IAMB.sol";
import "./PPMediatorStorage.sol";

contract PPMediatorCommon is Ownable, Initializable, PPMediatorCommonStorage {
  event SetMediatorContractOnOtherSide(address indexed mediatorContractOnOtherSide);
  event SetAmb(address indexed amb);
  event SetRequestGasLimit(uint256 requestGasLimit);

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

  function setMediatorContractOnOtherSide(address _mediatorContractOnOtherSide) external onlyOwner {
    mediatorContractOnOtherSide = _mediatorContractOnOtherSide;
    emit SetMediatorContractOnOtherSide(_mediatorContractOnOtherSide);
  }

  function setAmb(address _amb) external onlyOwner {
    amb = IAMB(_amb);
    emit SetAmb(_amb);
  }

  function setRequestGasLimit(uint256 _requestGasLimit) external onlyOwner {
    requestGasLimit = _requestGasLimit;
    emit SetRequestGasLimit(_requestGasLimit);
  }
}
