const { constants, time } = require('@openzeppelin/test-helpers');
const { deployProxied, ether, getEventArg, advanceBlocks, fetchLogs } = require('./helpers');

const { solidity } = require('ethereum-waffle');

const chai = require('chai');
const MockAMB = artifacts.require('MockAMB');
const PPMediatorL1 = artifacts.require('PPMediatorL1');
const PPMediatorL2 = artifacts.require('PPMediatorL2');
const CVP = artifacts.require('Cvp');
const Timelock = artifacts.require('MockTimelock');
// const PPGovernorL1 = artifacts.require('PPGovernorL1');
const PPGovernorL1 = artifacts.require('MockPPGovernorL1');
const PPGovernorL2 = artifacts.require('MockPPGovernorL2');
// const PPGovernorL2 = artifacts.require('PPGovernorL2');

chai.use(solidity);
const { expect } = chai;

CVP.numberFormat = 'String';
PPMediatorL1.numberFormat = 'String';
PPMediatorL2.numberFormat = 'String';
PPGovernorL1.numberFormat = 'String';
PPGovernorL2.numberFormat = 'String';
MockAMB.numberFormat = 'String';

const TWO_DAYS = 2 * 86400;
const PROPOSE_SIGNATURE = '0xda95691a';
const CAST_VOTE_SIGNATURE = '0x15373e3d';

describe('L2 Voting Behaviour Tests', function () {
  let cvp;
  let timelockL1;
  let timelockL2;
  let governorL1;
  let governorL2;
  let mediatorL1;
  let mediatorL2;
  let amb;

  let deployer, owner, alice, bob;

  before(async function() {
    [deployer, owner, alice, bob] = await web3.eth.getAccounts();
  });

  beforeEach(async function () {
    cvp = await CVP.new(owner);

    amb = await MockAMB.new();
    timelockL1 = await Timelock.new(deployer, TWO_DAYS);
    timelockL2 = await Timelock.new(deployer, TWO_DAYS);

    // It's ok for the test purposes use bytecode of PPGovenrorL2 as PPGovenrorL1
    governorL1 = await PPGovernorL1.new(timelockL1.address, [cvp.address], constants.ZERO_ADDRESS);

    mediatorL1 = await deployProxied(PPMediatorL1, [
      // owner
      owner,
      // governor
      governorL1.address,
      // token
      cvp.address,
      // amb
      amb.address,
      // mediatorContractOnOtherSide (not deployed yet)
      constants.ZERO_ADDRESS,
      // requestGasLimit
      2 * 1000 * 1000
    ], { deployer, proxyAdminOwner: owner });

    mediatorL2 = await deployProxied(PPMediatorL2, [
      // owner
      owner,
      // votingTimelock
      timelockL2.address,
      // amb
      amb.address,
      // mediatorContractOnOtherSide
      mediatorL1.address,
      // requestGasLimit
      2 * 1000 * 1000
    ], { deployer });

    // MediatorL2 not known yet
    governorL2 = await PPGovernorL2.new(timelockL2.address, [mediatorL2.address], constants.ZERO_ADDRESS);

    await mediatorL1.setMediatorContractOnOtherSide(mediatorL2.address, { from: owner });

    await timelockL1.forceAdmin(governorL1.address);
    await timelockL2.forceAdmin(governorL2.address);

    await mediatorL1.setDelegatee({ from: owner });

    await mediatorL1.transferOwnership(timelockL1.address, { from: owner });
    await mediatorL2.transferOwnership(timelockL2.address, { from: owner });

    // Lock some CVPs
    await cvp.transfer(alice, ether(1000 * 1000), { from: owner });
    await cvp.transfer(bob, ether(1000 * 1000), { from: owner });
    await cvp.delegate(bob, { from: bob });

    await cvp.approve(mediatorL1.address, ether(500 * 1000), { from: alice });
    await mediatorL1.deposit(ether(500 * 1000), { from: alice });

    const handleBalanceUpdatesCall = mediatorL2.contract.methods.handleBalanceUpdates(
      [alice],
      [ether(500 * 1000)]
    ).encodeABI();
    await amb.executeMessageCall(mediatorL2.address, mediatorL1.address, handleBalanceUpdatesCall, '0x1', 2000000);

    expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal(ether(500 * 1000))
  });

  it('should allow locking tokens and creating a proposal', async function () {
    // Create a proposal at L2
    // governorL1's timelock on a proposal success executes mediatorL1.setRequestGasLimit()
    const thirdCall = mediatorL1.contract.methods.setRequestGasLimit(42).encodeABI();
    // mediatorL1 receives AMB message and calls governorL1.propose()
    const secondCall = governorL1.contract.methods.propose(
      [mediatorL1.address],
      [0],
      [''],
      [thirdCall],
      'Hello from L2'
    ).encodeABI();
    // governorL2's timelock on a proposal success executes mediatorL2.callGovernorL1()
    const firstCall = mediatorL2.contract.methods.callGovernorL1(
      PROPOSE_SIGNATURE,
      `0x${secondCall.substring(10)}`
    ).encodeABI();
    // alice creates a proposal in governorL2
    await governorL2.propose(
      [mediatorL2.address],
      [0],
      [''],
      [firstCall],
      'Send it to L1',
      { from: alice }
    );
    await advanceBlocks(1);
    await governorL2.castVote(1, true, { from: alice })
    await advanceBlocks(6);
    await governorL2.queue(1);
    await time.increase(86400 * 2);
    let res = await governorL2.execute(1);

    let logs = await fetchLogs(MockAMB, res);
    const destination = getEventArg({ logs }, 'RequireToPassMessage', 'destination');
    const data = getEventArg({ logs }, 'RequireToPassMessage', 'data');

    const messageId = '0x2'
    res = await amb.executeMessageCall(destination, mediatorL2.address, data, messageId, 2000000);
    expect(await amb.messageCallStatus(messageId)).to.be.true;

    logs = await fetchLogs(PPGovernorL2, res);
    const proposalId = getEventArg({ logs }, 'ProposalCreated', 'id');
    const proposal = await governorL1.getActions(proposalId);
    expect(proposal.targets[0]).to.be.equal(mediatorL1.address);
    expect(proposal.calldatas[0]).to.be.equal(thirdCall);

    // Cast a vote on L1
    await advanceBlocks(proposalId);
    await governorL1.castVote(proposalId, true, { from: bob });
    await advanceBlocks(15);
    await governorL1.queue(proposalId);

    await time.increase(86400 * 2);

    expect(await mediatorL1.requestGasLimit()).to.be.equal('2000000');
    await governorL1.execute(proposalId);
    expect(await mediatorL1.requestGasLimit()).to.be.equal('42');
  });

  it('should allow locking tokens and casting a vote', async function () {
    // Create a proposal at L1
    const calldata = mediatorL1.contract.methods.setRequestGasLimit(42).encodeABI();
    let res = await governorL1.propose(
      [mediatorL1.address],
      [0],
      [''],
      [calldata],
      'Set gas limit 42',
      { from: bob }
    )
    const proposalId = getEventArg(res, 'ProposalCreated', 'id');

    // Cast a vote on L2
    const secondCall = governorL1.contract.methods.castVote(proposalId, true).encodeABI();
    const firstCall = mediatorL2.contract.methods.callGovernorL1(
      CAST_VOTE_SIGNATURE,
      `0x${secondCall.substring(10)}`
    ).encodeABI();
    // alice creates a proposal in governorL2
    await governorL2.propose(
      [mediatorL2.address],
      [0],
      [''],
      [firstCall],
      'Send it to L1',
      { from: alice }
    );
    await advanceBlocks(1);
    await governorL2.castVote(1, true, { from: alice })
    await advanceBlocks(6);
    await governorL2.queue(1);
    await time.increase(86400 * 2);
    res = await governorL2.execute(1);

    let logs = await fetchLogs(MockAMB, res);
    const destination = getEventArg({ logs }, 'RequireToPassMessage', 'destination');
    const data = getEventArg({ logs }, 'RequireToPassMessage', 'data');

    const messageId = '0x2'
    await advanceBlocks(1);
    res = await amb.executeMessageCall(destination, mediatorL2.address, data, messageId, 2000000);
    expect(await amb.messageCallStatus(messageId)).to.be.true;

    logs = await fetchLogs(PPGovernorL1, res);
    getEventArg({ logs }, 'VoteCast', 'proposalId');
    const proposal = await governorL1.proposals(proposalId);
    expect(proposal.forVotes).to.be.equal(await cvp.balanceOf(mediatorL1.address));

    await advanceBlocks(7);
    await governorL1.queue(proposalId);

    await time.increase(86400 * 2);

    expect(await mediatorL1.requestGasLimit()).to.be.equal('2000000');
    await governorL1.execute(proposalId);
    expect(await mediatorL1.requestGasLimit()).to.be.equal('42');
  });
});
