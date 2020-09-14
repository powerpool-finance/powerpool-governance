pragma solidity ^0.5.16;

contract MockAMB {
  event MockedEvent(bytes32 indexed messageId, bytes encodedData);
  event RequireToPassMessage(address destination, bytes data, uint256 gas);

  address public messageSender;
  uint256 public maxGasPerTx;
  bytes32 public transactionHash;
  bytes32 public messageId;
  uint64 public nonce;
  uint256 public messageSourceChainId;
  mapping(bytes32 => bool) public messageCallStatus;
  mapping(bytes32 => bytes) public failedMessageResponse;
  mapping(bytes32 => address) public failedMessageSender;
  mapping(bytes32 => address) public failedMessageReceiver;
  mapping(bytes32 => bytes32) public failedMessageDataHash;

  function setMaxGasPerTx(uint256 _value) public {
    maxGasPerTx = _value;
  }

  function executeMessageCall(
    address _contract,
    address _sender,
    bytes memory _data,
    bytes32 _messageId,
    uint256 _gas
  ) public {
    messageSender = _sender;
    messageId = _messageId;
    transactionHash = _messageId;
    messageSourceChainId = 1337;
    (bool status, bytes memory response) = _contract.call.gas(_gas)(_data);
    messageSender = address(0);
    messageId = bytes32(0);
    transactionHash = bytes32(0);
    messageSourceChainId = 0;

    messageCallStatus[_messageId] = status;
    if (!status) {
      failedMessageResponse[_messageId] = response;
      failedMessageDataHash[_messageId] = keccak256(_data);
      failedMessageReceiver[_messageId] = _contract;
      failedMessageSender[_messageId] = _sender;
    }
  }

  function requireToPassMessage(
    address _contract,
    bytes calldata _data,
    uint256 _gas
  ) external returns (bytes32) {
    emit RequireToPassMessage(_contract, _data, _gas);
    require(messageId == bytes32(0), "MockAmb:requireToPassMessage: messageId is 0");
    bytes32 bridgeId = keccak256(abi.encodePacked(uint16(1337), address(this))) &
      0x00000000ffffffffffffffffffffffffffffffffffffffff0000000000000000;

    bytes32 _messageId = bytes32(uint256(0x11223344 << 224)) | bridgeId | bytes32(uint256(nonce));
    nonce += 1;
    bytes memory eventData = abi.encodePacked(
      _messageId,
      msg.sender,
      _contract,
      uint32(_gas),
      uint8(2),
      uint8(2),
      uint8(0x00),
      uint16(1337),
      uint16(1338),
      _data
    );

    emit MockedEvent(_messageId, eventData);
    return _messageId;
  }

  function sourceChainId() external pure returns (uint256) {
    return 1337;
  }
}
