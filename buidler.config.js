const { usePlugin } = require('@nomiclabs/buidler/config');

usePlugin('@nomiclabs/buidler-truffle5');
usePlugin('solidity-coverage');
usePlugin('buidler-contract-sizer');
usePlugin('buidler-gas-reporter');


const config = {
  analytics: {
    enabled: false,
  },
  contractSizer: {
    alphaSort: false,
    runOnCompile: false,
  },
  defaultNetwork: 'buidlerevm',
  gasReporter: {
    currency: 'USD',
    enabled: !!(process.env.REPORT_GAS)
  },
  mocha: {},
  networks: {
    buidlerevm: {
      chainId: 31337,
    },
    local: {
      url: 'http://127.0.0.1:8545',
    },
    coverage: {
      url: 'http://127.0.0.1:8555',
    },
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    coverage: './coverage',
    coverageJson: './coverage.json',
    root: './',
    sources: './contracts',
    tests: './test',
  },
  solc: {
    /* https://buidler.dev/buidler-evm/#solidity-optimizer-support */
    optimizer: {
      enabled: true,
      runs: 200,
    },
    version: '0.5.16',
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
};

module.exports = config;
