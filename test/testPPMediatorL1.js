const { constants, expectEvent, time } = require('@openzeppelin/test-helpers');
const { deployProxied, decodeRevertBytes, fetchLogs, createOrGetProxyAdmin, K } = require('./helpers');

const { solidity } = require('ethereum-waffle');

const chai = require('chai');
const MockAMB = artifacts.require('MockAMB');
const PPMediatorL1 = artifacts.require('PPMediatorL1');
const PPMediatorL2 = artifacts.require('PPMediatorL2');
const CVP = artifacts.require('Cvp');
const Timelock = artifacts.require('MockTimelock');
const PPGovernorL1 = artifacts.require('MockPPGovernorL1');

chai.use(solidity);
const { expect } = chai;

CVP.numberFormat = 'String';
PPMediatorL1.numberFormat = 'String';
PPGovernorL1.numberFormat = 'String';
MockAMB.numberFormat = 'String';

const TWO_DAYS = 2 * 86400;

describe('PPMediatorL1', function () {
  let cvp;
  let timelockL1;
  let governorL1;
  let mediatorL1;
  let mediatorL2;
  let amb;
  let proxyAdmin;

  let deployer, owner, mediatorL2Address, alice, bob, charlie, nonZero;

  before(async function() {
    [deployer, owner, mediatorL2Address, alice, bob, charlie, nonZero] = await web3.eth.getAccounts();
    mediatorL2 = await PPMediatorL2.new();
  });

  beforeEach(async function () {
    cvp = await CVP.new(owner);

    amb = await MockAMB.new();
    timelockL1 = await Timelock.new(deployer, TWO_DAYS);

    // It's ok for the test purposes use bytecode of PPGovernorL2 as PPGovernorL1
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
      // mediatorContractOnOtherSide
      mediatorL2Address,
      // requestGasLimit
      2 * 1000 * 1000
    ], { deployer, proxyAdminOwner: owner });

    await timelockL1.forceAdmin(governorL1.address);

    // Lock some CVPs
    await cvp.transfer(alice, K(1000), { from: owner });
    await cvp.transfer(bob, K(1000), { from: owner });

    proxyAdmin = await createOrGetProxyAdmin(owner);
  });

  describe('initialization', () => {
    it('should be initialized with correct values', async function() {
      expect(await proxyAdmin.owner()).to.be.equal(owner);
      expect(await proxyAdmin.getProxyAdmin(mediatorL1.address)).to.be.equal(proxyAdmin.address);
      expect(await mediatorL1.governor()).to.be.equal(governorL1.address);
      expect(await mediatorL1.cvpToken()).to.be.equal(cvp.address);
      expect(await mediatorL1.amb()).to.be.equal(amb.address);
      expect(await mediatorL1.mediatorContractOnOtherSide()).to.be.equal(mediatorL2Address);
      expect(await mediatorL1.requestGasLimit()).to.be.equal(String(2 * 1000 * 1000));
    });

    it('should deny calling initialization twice', async function() {
      await expect(mediatorL1.initialize(
        // owner
        nonZero,
        // governor
        nonZero,
        // token
        nonZero,
        // amb
        nonZero,
        // mediatorContractOnOtherSide
        nonZero,
        // requestGasLimit
        1
      )).to.be.revertedWith('Contract instance has already been initialized');
    });

    describe('invalid values', () => {
      let mediator;

      beforeEach(async function() {
        mediator = await PPMediatorL1.new();
      })

      it('should deny initialization with zero owner address', async function() {
        await expect(mediator.initialize(
          // owner
          constants.ZERO_ADDRESS,
          // governor
          nonZero,
          // token
          nonZero,
          // amb
          nonZero,
          // mediatorContractOnOtherSide
          nonZero,
          // requestGasLimit
          1
        )).to.be.revertedWith('PPMediatorCommon:initialize: Invalid _owner address');
      });

      it('should deny initialization with zero governor address', async function() {
        await expect(mediator.initialize(
          // owner
          nonZero,
          // governor
          constants.ZERO_ADDRESS,
          // token
          nonZero,
          // amb
          nonZero,
          // mediatorContractOnOtherSide
          nonZero,
          // requestGasLimit
          1
        )).to.be.revertedWith('PPMediatorL1:initialize: Invalid _governor address');
      });

      it('should deny initialization with zero cvpToken address', async function() {
        await expect(mediator.initialize(
          // owner
          nonZero,
          // governor
          nonZero,
          // token
          constants.ZERO_ADDRESS,
          // amb
          nonZero,
          // mediatorContractOnOtherSide
          nonZero,
          // requestGasLimit
          1
        )).to.be.revertedWith('PPMediatorL1:initialize: Invalid _cvpToken address');
      });

      it('should deny initialization with zero amb address', async function() {
        await expect(mediator.initialize(
          // owner
          nonZero,
          // governor
          nonZero,
          // token
          nonZero,
          // amb
          constants.ZERO_ADDRESS,
          // mediatorContractOnOtherSide
          nonZero,
          // requestGasLimit
          1
        )).to.be.revertedWith('PPMediatorCommon:initialize: Invalid _amb address');
      });

      it('should deny initialization with zero gas limit', async function() {
        await expect(mediator.initialize(
          // owner
          nonZero,
          // governor
          nonZero,
          // token
          nonZero,
          // amb
          nonZero,
          // mediatorContractOnOtherSide
          nonZero,
          // requestGasLimit
          0
        )).to.be.revertedWith('PPMediatorCommon:initialize: Invalid _requestGasLimit value');
      });
    })
  })

  describe('deposit', () => {
    it('should allow any CVP holder depositing their tokens', async function () {
      expect(await cvp.balanceOf(mediatorL1.address)).to.be.equal('0');

      await cvp.approve(mediatorL1.address, K(500), { from: alice });
      await mediatorL1.deposit(K(500), { from: alice });
      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(500));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(500));

      expect(await cvp.balanceOf(mediatorL1.address)).to.be.equal(K(500));
    });

    it('should deny deposition 0 tokens', async function () {
      await cvp.approve(mediatorL1.address, '0', { from: alice });
      await expect(mediatorL1.deposit('0', { from: alice }))
        .to.be.revertedWith('PPMediatorL1:deposit: Amount should be positive');
    });

    it('should deny deposition > 2**96 tokens', async function () {
      await expect(mediatorL1.deposit(String(2n**96n + 1n), { from: alice }))
        .to.be.revertedWith('PPMediatorL1::deposit: amount exceeds 96 bits');
    });

    it('should update total supply on second deposit', async function () {
      await cvp.approve(mediatorL1.address, K(500), { from: alice });
      await mediatorL1.deposit(K(500), { from: alice });

      await cvp.approve(mediatorL1.address, K(100), { from: alice });
      await mediatorL1.deposit(K(100), { from: alice });

      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(600));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(600));
    });

    it('should update total supply on different member deposits', async function () {
      await cvp.approve(mediatorL1.address, K(500), { from: alice });
      await mediatorL1.deposit(K(500), { from: alice });

      await cvp.approve(mediatorL1.address, K(100), { from: bob });
      await mediatorL1.deposit(K(100), { from: bob });

      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(500));
      expect(await mediatorL1.cvpLocked(bob)).to.be.equal(K(100));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(600));
    });

    it('should send balance update message', async function () {
      const data1 = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(500)]).encodeABI();
      const data2 = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(600)]).encodeABI();

      // msg #1
      await cvp.approve(mediatorL1.address, K(500), { from: alice });
      let res = await mediatorL1.deposit(K(500), { from: alice });
      let logs = await fetchLogs(MockAMB, res);

      expectEvent({ logs }, 'RequireToPassMessage', {
        destination: mediatorL2Address,
        data: data1
      })

      // msg #2
      await cvp.approve(mediatorL1.address, K(100), { from: alice });
      res = await mediatorL1.deposit(K(100), { from: alice });
      logs = await fetchLogs(MockAMB, res);

      expectEvent({ logs }, 'RequireToPassMessage', {
        destination: mediatorL2Address,
        data: data2
      })
    });
  });

  describe('withdraw', () => {
    beforeEach(async function() {
      await cvp.approve(mediatorL1.address, K(500), { from: alice });
      await mediatorL1.deposit(K(500), { from: alice });
    });

    it('should allow withdrawing partial amount of locked tokens', async function () {
      expect(await cvp.balanceOf(mediatorL1.address)).to.be.equal(K(500));
      expect(await cvp.balanceOf(charlie)).to.be.equal('0');

      await mediatorL1.withdraw(charlie, K(100), { from: alice });

      expect(await cvp.balanceOf(mediatorL1.address)).to.be.equal(K(400));
      expect(await cvp.balanceOf(charlie)).to.be.equal(K(100));

      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(400));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(400));
    });

    it('should allow withdrawing full amount of locked tokens', async function () {
      expect(await cvp.balanceOf(mediatorL1.address)).to.be.equal(K(500));
      expect(await cvp.balanceOf(charlie)).to.be.equal('0');

      await mediatorL1.withdraw(charlie, K(500), { from: alice });

      expect(await cvp.balanceOf(mediatorL1.address)).to.be.equal(K(0));
      expect(await cvp.balanceOf(charlie)).to.be.equal(K(500));

      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(0));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(0));
    });

    it('should deny withdrawing more than locked', async function () {
      await cvp.approve(mediatorL1.address, K(100), { from: bob });
      await mediatorL1.deposit(K(100), { from: bob });

      await expect(mediatorL1.withdraw(charlie, K(501), { from: alice }))
        .to.be.revertedWith('PPMediatorL1:deposit: Can\'t withdraw more than locked');
    });

    it('should deny withdrawing 0 tokens', async function () {
      const amount = '0';
      await expect(mediatorL1.withdraw(charlie, amount, { from: alice }))
        .to.be.revertedWith('PPMediatorL1:withdraw: Amount should be positive');
    });

    it('should deny withdrawing to the contract address', async function () {
      await expect(mediatorL1.withdraw(mediatorL1.address, K(100), { from: alice }))
        .to.be.revertedWith('PPMediatorL1:withdraw: Can\'t withdraw to 0 or self');
    });

    it('should deny withdrawing to zero address', async function () {
      await expect(mediatorL1.withdraw(constants.ZERO_ADDRESS, K(100), { from: alice }))
        .to.be.revertedWith('PPMediatorL1:withdraw: Can\'t withdraw to 0 or self');
    });

    it('should update total supply on multiple withdrawals', async function () {
      await mediatorL1.withdraw(charlie, K(100), { from: alice });
      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(400));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(400));

      await mediatorL1.withdraw(charlie, K(150), { from: alice });
      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(250));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(250));
    });

    it('should update total supply on different member withdrawals', async function () {
      await cvp.approve(mediatorL1.address, K(100), { from: bob });
      await mediatorL1.deposit(K(100), { from: bob });

      await mediatorL1.withdraw(charlie, K(100), { from: alice });
      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(400));
      expect(await mediatorL1.cvpLocked(bob)).to.be.equal(K(100));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(500));

      await mediatorL1.withdraw(charlie, K(50), { from: bob });
      expect(await mediatorL1.cvpLocked(alice)).to.be.equal(K(400));
      expect(await mediatorL1.cvpLocked(bob)).to.be.equal(K(50));
      expect(await mediatorL1.totalCvpLocked()).to.be.equal(K(450));
    });

    it('should send balance update message', async function () {
      const data1 = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(300)]).encodeABI();
      const data2 = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(150)]).encodeABI();

      // msg #1
      let res = await mediatorL1.withdraw(charlie, K(200), { from: alice });
      let logs = await fetchLogs(MockAMB, res);

      expectEvent({ logs }, 'RequireToPassMessage', {
        destination: mediatorL2Address,
        data: data1
      })

      // msg #2
      res = await mediatorL1.withdraw(charlie, K(150), { from: alice });
      logs = await fetchLogs(MockAMB, res);

      expectEvent({ logs }, 'RequireToPassMessage', {
        destination: mediatorL2Address,
        data: data2
      })
    });
  });

  describe('syncBalances', () => {
    beforeEach(async function() {
      await cvp.approve(mediatorL1.address, K(500), { from: alice });
      await mediatorL1.deposit(K(500), { from: alice });
      await cvp.approve(mediatorL1.address, K(300), { from: bob });
      await mediatorL1.deposit(K(300), { from: bob });
    });

    it('should allow sending a single balance update', async function() {
      const data1 = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(500)]).encodeABI();

      let res = await mediatorL1.syncBalances([alice], { from: charlie });
      let logs = await fetchLogs(MockAMB, res);

      expectEvent({ logs }, 'RequireToPassMessage', {
        destination: mediatorL2Address,
        data: data1
      });

      logs = await fetchLogs(PPMediatorL1, res);

      expectEvent({ logs }, 'SyncBalances', {
        sender: charlie,
        accountsLength: '1'
      })
    });

    it('should allow sending multiple balance updates', async function() {
      const data1 = mediatorL2.contract.methods
        .handleBalanceUpdates([alice, charlie, bob], [K(500), K(0), K(300)]).encodeABI();

      let res = await mediatorL1.syncBalances([alice, charlie, bob], { from: charlie });
      let logs = await fetchLogs(MockAMB, res);

      expectEvent({ logs }, 'RequireToPassMessage', {
        destination: mediatorL2Address,
        data: data1
      });

      logs = await fetchLogs(PPMediatorL1, res);

      expectEvent({ logs }, 'SyncBalances', {
        sender: charlie,
        accountsLength: '3'
      })
    });

    it('should deny sending an update with 0 addresses', async function() {
      await expect(mediatorL1.syncBalances([]))
        .to.be.revertedWith('PPMediatorL1:deposit: Empty accounts array');
    });
  });

  describe('handleCallGovernorL1', () => {
    let data1;
    let data2;
    let data3;
    let mediatorArgs;
    const messageId = web3.utils.padLeft(web3.utils.numberToHex(3), 64);
    const gasLimit = 2 * 1000 * 1000;
    const proposalId = '1';

    beforeEach(async function() {
      // incorrect way to deposit, but it works for these tests
      await cvp.transfer(mediatorL1.address, K(500), { from: owner });

      await mediatorL1.setDelegatee({ from: owner });

      data1 = mediatorL1.contract.methods.setRequestGasLimit(42).encodeABI();
      data2 = governorL1.contract.methods.propose([mediatorL1.address], [0], [''], [data1], 'Hey').encodeABI();
      mediatorArgs = [data2.substring(0, 10), `0x${data2.substring(10)}`];
      data3 = mediatorL1.contract.methods.handleCallGovernorL1(...mediatorArgs).encodeABI();
    });

    it('should allow creating proposals in governanceL1 contract', async function() {
      const res = await amb.executeMessageCall(mediatorL1.address, mediatorL2Address, data3, messageId, gasLimit);
      expect(await amb.messageCallStatus(messageId)).to.be.true;

      let logs = await fetchLogs(PPGovernorL1, res);
      expectEvent({ logs }, 'ProposalCreated', {
        id: '1',
        description: 'Hey'
      })

      logs = await fetchLogs(PPMediatorL1, res);
      expectEvent({ logs }, 'HandleVotingDecision', {
        msgId: messageId,
        signature: mediatorArgs[0],
        args: mediatorArgs[1]
      });

      const proposal = await governorL1.getActions(proposalId);
      expect(proposal.targets).to.have.same.members([mediatorL1.address]);
      expect(proposal.values).to.have.same.members(['0']);
      expect(proposal.signatures).to.have.same.members(['']);
      expect(proposal.calldatas).to.have.same.members([data1]);
    });

    it('should allow casting votes in governanceL1 contract', async function() {
      await cvp.delegate(alice, { from: alice });
      await governorL1.propose([mediatorL1.address], [0], [''], [data1], 'Hey', { from: alice });

      await time.advanceBlock();
      data2 = governorL1.contract.methods.castVote(1, true).encodeABI();
      mediatorArgs = [data2.substring(0, 10), `0x${data2.substring(10)}`];
      data3 = mediatorL1.contract.methods.handleCallGovernorL1(...mediatorArgs).encodeABI();

      const res = await amb.executeMessageCall(mediatorL1.address, mediatorL2Address, data3, messageId, gasLimit);
      expect(await amb.messageCallStatus(messageId)).to.be.true;

      let logs = await fetchLogs(PPGovernorL1, res);
      expectEvent({ logs }, 'VoteCast', {
        voter: mediatorL1.address,
        proposalId: '1',
        support: true,
      })

      logs = await fetchLogs(PPMediatorL1, res);
      expectEvent({ logs }, 'HandleVotingDecision', {
        msgId: messageId,
        signature: mediatorArgs[0],
        args: mediatorArgs[1],
      });

      const proposal = await governorL1.proposals(proposalId);
      expect(proposal.forVotes).to.be.equal(await cvp.balanceOf(mediatorL1.address));
    });

    it('should deny non-amb calling the method', async function() {
      await expect(mediatorL1.handleCallGovernorL1(...mediatorArgs, { from: owner }))
        .to.be.revertedWith('PPMediatorL1::handleBalanceUpdate: Only AMB allowed');
    });

    it('should deny non-mediator being an initiator of the call on L2 side', async function() {
      await amb.executeMessageCall(mediatorL1.address, bob, data3, messageId, gasLimit)
      expect(await amb.messageCallStatus(messageId)).to.be.false;
      expect(decodeRevertBytes(await amb.failedMessageResponse(messageId)))
        .to.be.equal('PPMediatorL1::handleBalanceUpdate: Invalid message sender')
    });

    it('should deny non-mediator being an initiator of the call on L2 side', async function() {
      await amb.executeMessageCall(mediatorL1.address, bob, data3, messageId, gasLimit)
      expect(await amb.messageCallStatus(messageId)).to.be.false;
      expect(decodeRevertBytes(await amb.failedMessageResponse(messageId)))
        .to.be.equal('PPMediatorL1::handleBalanceUpdate: Invalid message sender')
    });

    it('should deny calling non-whitelisted methods', async function() {
      data2 = governorL1.contract.methods.queue(2).encodeABI();
      mediatorArgs = [data2.substring(0, 10), `0x${data2.substring(10)}`];
      data3 = mediatorL1.contract.methods.handleCallGovernorL1(...mediatorArgs).encodeABI();
      await amb.executeMessageCall(mediatorL1.address, mediatorL2Address, data3, messageId, gasLimit)
      expect(await amb.messageCallStatus(messageId)).to.be.false;
      expect(decodeRevertBytes(await amb.failedMessageResponse(messageId)))
        .to.be.equal('PPMediatorL1:handleVotingDecision: Unsupported signature')
    });
  });

  describe('owner methods', () => {
    describe('setMediatorContractOnOtherSide', async function() {
      it('should allow owner setting a new contract address', async function() {
        const res = await mediatorL1.setMediatorContractOnOtherSide(alice, { from: owner });
        expectEvent(res, 'SetMediatorContractOnOtherSide', { mediatorContractOnOtherSide: alice });
        expect(await mediatorL1.mediatorContractOnOtherSide()).to.be.equal(alice);
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL1.setMediatorContractOnOtherSide(alice, { from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });

    describe('setAmb', async function() {
      it('should allow owner setting a new amb address', async function() {
        const res = await mediatorL1.setAmb(alice, { from: owner });
        expectEvent(res, 'SetAmb', { amb: alice });
        expect(await mediatorL1.amb()).to.be.equal(alice);
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL1.setAmb(alice, { from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });

    describe('setRequestGasLimit', async function() {
      it('should allow owner setting a new contract address', async function() {
        const res = await mediatorL1.setRequestGasLimit(42, { from: owner });
        expectEvent(res, 'SetRequestGasLimit', { requestGasLimit: '42' });
        expect(await mediatorL1.requestGasLimit()).to.be.equal('42');
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL1.setRequestGasLimit(alice, { from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });

    describe('setGovernor', async function() {
      it('should allow the owner setting a new governor address', async function() {
        const res = await mediatorL1.setGovernor(bob, { from: owner });
        expectEvent(res, 'SetGovernor', { governor: bob });
        expect(await mediatorL1.governor()).to.be.equal(bob);
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL1.setGovernor(alice, { from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });

    describe('setDelegatee', async function() {
      it('should allow owner setting the contract delegate to the contract itself', async function() {
        expect(await cvp.delegates(mediatorL1.address)).to.be.equal(constants.ZERO_ADDRESS);
        await mediatorL1.setDelegatee({ from: owner });
        expect(await cvp.delegates(mediatorL1.address)).to.be.equal(mediatorL1.address);
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL1.setDelegatee({ from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });
  });
});
