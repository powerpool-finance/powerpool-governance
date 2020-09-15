# PowerPool Governance Contracts

[![Actions Status](https://github.com/powerpool-finance/powerpool-governance/workflows/CI/badge.svg)](https://github.com/powerpool-finance/powerpool-governance/actions)

This repository contains the set of smart contracts, used for decision-making by PowerPool community regarding the protocol development, protocol parameters, and smart contracts upgrades. It provides an opportunity to vote by CVP token holders (including CVP, locked especially for votings), the participants of Beta and Gamma rounds (using vested CVP tokens), and liquidity providers (using BPT/UNI LP tokens). Participance in governance for mentioned groups of users is available on Ethereum mainnet and sidechains, such as xDAI and Matic.

More details in 👉 [Specification](https://github.com/powerpool-finance/powerpool-docs/blob/master/specifications/PowerPool-governance.md).

🚨 **Security review status: an audit is in progress**

## Contracts on Ethereum Main Network
PPGovernorL1 - [0xefe147ffc12b847c0f2b6f19c11fa8266a8e3ddf](https://etherscan.io/address/0xefe147ffc12b847c0f2b6f19c11fa8266a8e3ddf)
Timelock - [0xb712ab1263fd2d992e39df1cf3f81ea9bb83e548](https://etherscan.io/address/0xb712ab1263fd2d992e39df1cf3f81ea9bb83e548)
CVP - [0x38e4adb44ef08f22f5b5b76a8f0c2d0dcbe7dca1](https://etherscan.io/address/0x38e4adb44ef08f22f5b5b76a8f0c2d0dcbe7dca1)

## Testing and Development

Use `yarn` or `npm` to run the following npm tasks:

- `yarn compile` - compile contracts
- `yarn test` - run tests
- `yarn coverage` - generate test coverage report
