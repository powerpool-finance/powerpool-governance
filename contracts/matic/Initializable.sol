pragma solidity ^0.5.16;

contract Initializable {
  bool public inited = false;

  modifier initializer() {
    require(!inited, "already inited");
    _;
    inited = true;
  }
}
