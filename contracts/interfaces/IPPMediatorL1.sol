pragma solidity ^0.5.16;

interface IPPMediatorL1 {
  function handleCallGovernorL1(bytes4 _signature, bytes calldata _args) external;
}
