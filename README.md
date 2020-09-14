# PowerPool Governance Contracts

[![Actions Status](https://github.com/powerpool-finance/powerpool-governance/workflows/CI/badge.svg)](https://github.com/powerpool-finance/powerpool-governance/actions)

This repository contains the set of smart contracts, used for decision-making by PowerPool community regarding the protocol development, protocol parameters, and smart contracts upgrades. It provides an opportunity to vote by CVP token holders (including CVP, locked especially for votings), the participants of Beta and Gamma rounds (using vested CVP tokens), and liquidity providers (using BPT/UNI LP tokens). Participance in governance for mentioned groups of users is available on Ethereum mainnet and sidechains, such as xDAI and Matic.

More details in 👉 [Specification]().

🚨 **Security review status: an audit is in progress**

## Testing and Development

Use `yarn` or `npm` to run the following npm tasks:

- `yarn compile` - compile contracts
- `yarn test` - run tests
- `yarn coverage` - generate test coverage report
