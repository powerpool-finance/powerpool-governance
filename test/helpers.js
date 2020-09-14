const TruffleContract = require('@nomiclabs/truffle-contract');
const { ether: etherBN, expectEvent } = require('@openzeppelin/test-helpers');
const { promisify } = require('util');

const AdminUpgradeabilityProxyArtifact = require('@openzeppelin/upgrades-core/artifacts/AdminUpgradeabilityProxy.json');
const ProxyAdminArtifact = require('@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json');
const template = artifacts.require('Timelock');
const AdminUpgradeabilityProxy = TruffleContract(AdminUpgradeabilityProxyArtifact);
const ProxyAdmin = TruffleContract(ProxyAdminArtifact);

AdminUpgradeabilityProxy.setProvider(template.currentProvider);
AdminUpgradeabilityProxy.defaults(template.class_defaults);
ProxyAdmin.setProvider(template.currentProvider);
ProxyAdmin.defaults(template.class_defaults);

let proxyAdmin;

/**
 * Deploys a proxied contract
 *
 * @param contract Truffle Contract
 * @param {string[]} args
 * @param {object} opts
 * @param {string} opts.deployer
 * @param {string} opts.initializer
 * @param {string} opts.proxyAdminOwner
 * @returns {Promise<any>}
 */
async function deployProxied(
  contract,
  args = [],
  opts = {}
) {
  const impl = await contract.new();
  const adminContract = await createOrGetProxyAdmin(opts.proxyAdminOwner);
  const data = getInitializerData(impl, args, opts.initializer);
  const proxy = await AdminUpgradeabilityProxy.new(impl.address, adminContract.address, data);
  const instance = await contract.at(proxy.address);

  instance.proxy = proxy;
  instance.initialImplementation = impl;

  return instance;
}

/**
 * Creates and returns ProxyAdmin contract
 * @param {string} proxyOwner
 * @returns {Promise<TruffleContract>}
 */
async function createOrGetProxyAdmin(proxyOwner) {
  if (!proxyAdmin) {
    proxyAdmin = await ProxyAdmin.new();
    await proxyAdmin.transferOwnership(proxyOwner);
  }
  return proxyAdmin;
}


function getInitializerData(impl, args, initializer) {
  const allowNoInitialization = initializer === undefined && args.length === 0;
  initializer = initializer || 'initialize';

  if (initializer in impl.contract.methods) {
    return impl.contract.methods[initializer](...args).encodeABI();
  } else if (allowNoInitialization) {
    return '0x';
  } else {
    throw new Error(`Contract ${impl.name} does not have a function \`${initializer}\``);
  }
}

function ether(value) {
  return etherBN(String(value)).toString();
}

/**
 * Finds a first event/arg occurrence and returns a value
 * @param {object} receipt
 * @param {object[]} receipt.logs
 * @param {string} eventName
 * @param {string} argName
 * @returns {any}
 */
function getEventArg(receipt, eventName, argName) {
  expectEvent(receipt, eventName);
  const logs = receipt.logs;
  for (let i = 0; i < logs.length; i++) {
    const event = logs[i];
    if (event.event === eventName) {
      if (argName in event.args) {
        return event.args[argName];
      }

      throw new Error(`helpers.js:getEventArgs: ${eventName} argument ${argName} missing`);
    }
  }
  throw new Error(`helpers.js:getEventArgs: Event ${eventName} not found`);
}

/**
 * Rewinds ganache by n blocks
 * @param {number} n
 * @returns {Promise<void>}
 */
async function advanceBlocks(n) {
  // eslint-disable-next-line no-undef
  // const heck = web3.currentProvider.send.bind(web3.currentProvider, );
  // const heck = new Promise((resolve, reject) => {
  const send = promisify(web3.currentProvider.send).bind(web3.currentProvider);
  const requests = [];
  for (let i = 0; i < n; i++) {
    requests.push(send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: `${new Date().getTime()}-${Math.random()}`,
    }));
  }
  await Promise.all(requests);
}

/**
 * Fetches logs of a given contract for a given tx,
 * since Truffle provides logs for a calle contract only.
 * @param {TruffleContract} contract
 * @param {object} receipt
 * @param {string} receipt.tx
 * @returns {Promise<{object}>}
 */
async function fetchLogs(contract, receipt) {
  const res = await web3.eth.getTransactionReceipt(receipt.tx);
  return contract.decodeLogs(res.logs);
}

/**
 * Shrinks function signature from ABI-encoded revert string.
 * @param value
 * @returns {string}
 */
function decodeRevertBytes(value) {
  return web3.eth.abi.decodeParameter('string', `0x${value.substring(10)}`);
}

/**
 * Splits calldata into a signature and arguments.
 * @param {string} data
 * @returns {(string)[]}
 */
function splitCalldata(data) {
  return [data.substring(0, 10), `0x${data.substring(10)}`]
}

/**
 * Makes operations with K-s more convenient.
 * @param v
 * @returns {string}
 */
function K(v) {
  return ether(v * 1000);
}

module.exports = {
  advanceBlocks,
  createOrGetProxyAdmin,
  deployProxied,
  ether,
  getEventArg,
  splitCalldata,
  fetchLogs,
  decodeRevertBytes,
  K
}
