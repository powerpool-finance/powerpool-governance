# PowerPool Governance Contracts

[![Actions Status](https://github.com/powerpool-finance/powerpool-governance/workflows/CI/badge.svg)](https://github.com/powerpool-finance/powerpool-governance/actions)

This repository contains the set of smart contracts, used for decision-making by PowerPool community regarding the protocol development, protocol parameters, and smart contracts upgrades. It provides an opportunity to vote by CVP token holders (including CVP, locked especially for votings), the participants of Beta and Gamma rounds (using vested CVP tokens), and liquidity providers (using BPT/UNI LP tokens). Participance in governance for mentioned groups of users is available on Ethereum mainnet and sidechains, such as xDAI and Matic.

More details in 👉 [Specification](https://github.com/powerpool-finance/powerpool-docs/blob/master/specifications/PowerPool-governance.md).

🚨 **Security review status: an audit is in progress**

## Contracts on Ethereum Main Network
### Active
- `PPGovernorL1` - [0x8234d0C4d27333e4103C3EBADC48b7dA7Cc72b45](https://etherscan.io/address/0x8234d0C4d27333e4103C3EBADC48b7dA7Cc72b45)
- `Timelock` - [0x6415cE217a981BBa24E12FC2Cc14fb2c4Ae08a7A](https://etherscan.io/address/0x6415cE217a981BBa24E12FC2Cc14fb2c4Ae08a7A)
- `CVP Token` - [0x38e4adb44ef08f22f5b5b76a8f0c2d0dcbe7dca1](https://etherscan.io/address/0x38e4adb44ef08f22f5b5b76a8f0c2d0dcbe7dca1)
- `SimpleVoting` - [0x54ebAf8c34D4Ada5A1D0936Ca11394d858Af13AC](https://etherscan.io/address/0x54ebAf8c34D4Ada5A1D0936Ca11394d858Af13AC)

### Deprecated
- `PPGovernorL1` - [0xdc27ad4351cec2099c438dae9f39aa38dbd50901](https://etherscan.io/address/0xdc27ad4351cec2099c438dae9f39aa38dbd50901)
- `Timelock` - [0xa40522994c6c85e5717cd12d5f50de50a2a2c4e3](https://etherscan.io/address/0xa40522994c6c85e5717cd12d5f50de50a2a2c4e3)

## Contracts on Matic Network
- `childCVP Token` - [0x530d954549F3Efa00799784BC7FE0C3FED76Da19](https://explorer.matic.network/address/0x530d954549F3Efa00799784BC7FE0C3FED76Da19/contracts)

## Testing and Development

Use `yarn` or `npm` to run the following npm tasks:

- `yarn compile` - compile contracts
- `yarn test` - run tests
- `yarn coverage` - generate test coverage report
