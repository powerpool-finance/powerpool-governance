const { constants, expectEvent, time } = require('@openzeppelin/test-helpers');
const { deployProxied, decodeRevertBytes, fetchLogs, createOrGetProxyAdmin, K, splitCalldata } = require('./helpers');

const { solidity } = require('ethereum-waffle');

const chai = require('chai');
const MockAMB = artifacts.require('MockAMB');
const PPMediatorL1 = artifacts.require('PPMediatorL1');
const PPMediatorL2 = artifacts.require('PPMediatorL2');
const CVP = artifacts.require('Cvp');
const Timelock = artifacts.require('MockTimelock');
const PPGovernorL2 = artifacts.require('MockPPGovernorL2');

chai.use(solidity);
const { expect } = chai;

CVP.numberFormat = 'String';
PPMediatorL1.numberFormat = 'String';
PPMediatorL2.numberFormat = 'String';
PPGovernorL2.numberFormat = 'String';
MockAMB.numberFormat = 'String';

const TWO_DAYS = 2 * 86400;
const messageId = web3.utils.padLeft(web3.utils.numberToHex(3), 64);

describe('PPMediatorL2', function () {
  let cvp;
  let timelockL2;
  let governorL2;
  let mediatorL1;
  let mediatorL2;
  let amb;
  let proxyAdmin;

  let deployer, owner, mediatorL1Address, alice, bob, charlie, nonZero, timelockStub;

  before(async function() {
    [deployer, owner, mediatorL1Address, alice, bob, charlie, nonZero, timelockStub] = await web3.eth.getAccounts();
    mediatorL1 = await PPMediatorL1.new();
  });

  beforeEach(async function () {
    cvp = await CVP.new(owner);

    amb = await MockAMB.new();
    timelockL2 = await Timelock.new(deployer, TWO_DAYS);

    // It's ok for the test purposes use bytecode of PPGovernorL2 as PPGovernorL1
    governorL2 = await PPGovernorL2.new(timelockL2.address, [cvp.address], constants.ZERO_ADDRESS);

    mediatorL2 = await deployProxied(PPMediatorL2, [
      // owner (is timelockL2 address for productiion deployment)
      owner,
      // timelock
      timelockL2.address,
      // amb
      amb.address,
      // mediatorContractOnOtherSide
      mediatorL1Address,
      // requestGasLimit
      2 * 1000 * 1000
    ], { deployer, proxyAdminOwner: owner });

    proxyAdmin = await createOrGetProxyAdmin(owner);
  });

  describe('initialization', () => {
    it('should be initialized with correct values', async function() {
      expect(await proxyAdmin.owner()).to.be.equal(owner);
      expect(await proxyAdmin.getProxyAdmin(mediatorL2.address)).to.be.equal(proxyAdmin.address);
      expect(await mediatorL2.governorL2Timelock()).to.be.equal(timelockL2.address);
      expect(await mediatorL2.amb()).to.be.equal(amb.address);
      expect(await mediatorL2.mediatorContractOnOtherSide()).to.be.equal(mediatorL1Address);
      expect(await mediatorL2.requestGasLimit()).to.be.equal(String(2 * 1000 * 1000));
    });

    it('should deny calling initialization twice', async function() {
      await expect(mediatorL2.initialize(
        // owner
        nonZero,
        // timelock
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
        mediator = await PPMediatorL2.new();
      })

      it('should deny initialization with zero owner address', async function() {
        await expect(mediator.initialize(
          // owner
          constants.ZERO_ADDRESS,
          // timelock
          nonZero,
          // amb
          nonZero,
          // mediatorContractOnOtherSide
          nonZero,
          // requestGasLimit
          1
        )).to.be.revertedWith('PPMediatorCommon:initialize: Invalid _owner address');
      });

      it('should deny initialization with zero timelock address', async function() {
        await expect(mediator.initialize(
          // owner
          nonZero,
          // timelock
          constants.ZERO_ADDRESS,
          // amb
          nonZero,
          // mediatorContractOnOtherSide
          nonZero,
          // requestGasLimit
          1
        )).to.be.revertedWith('PPMediatorL2:initialize: Invalid _governorL2Timelock address');
      });

      it('should deny initialization with zero amb address', async function() {
        await expect(mediator.initialize(
          // owner
          nonZero,
          // timelock
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
          // timelock
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

  describe('callGovernorL1', () => {
    let data;
    beforeEach(async function() {
      data = governorL2.contract.methods.castVote(42, true).encodeABI();
      await mediatorL2.setGovernorL2Timelock(timelockStub, { from: owner });
    });

    it('should allow governorL2Timelock sending any msg to amb', async function() {
      // governorL2 contract is used just for payload encoding here
      const data2 = mediatorL1.contract.methods.handleCallGovernorL1(...splitCalldata(data)).encodeABI();
      const res = await mediatorL2.callGovernorL1(...splitCalldata(data), { from: timelockStub });
      const logs = await fetchLogs(MockAMB, res);

      expectEvent(res, 'SendVotingDecision', {
        signature: splitCalldata(data)[0],
        args: splitCalldata(data)[1]
      })

      expectEvent({ logs }, 'RequireToPassMessage', {
        destination: mediatorL1Address,
        data: data2,
        gas: '2000000'
      });
    });

    it('should deny non-governor colling this method', async function() {
      await expect(mediatorL2.callGovernorL1(...splitCalldata(data), { from: owner }))
        .to.be.revertedWith('PPMediatorL2:callGovernorL1: Only governorL2Timelock allowed');
    });
  });

  describe('handleBalanceUpdates', () => {
    it('should update a single balance correctly', async function() {
      const data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(42)]).encodeABI();
      const res = await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);
      expect(await amb.messageCallStatus(messageId)).to.be.true;

      const logs = await fetchLogs(PPMediatorL2, res);

      expectEvent({ logs }, 'HandleBalanceUpdates', {
        accounts: [alice],
        balances: [K(42)]
      })

      expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal(K(42));
    });

    it('should update multiple balances correctly', async function() {
      const data = mediatorL2.contract.methods.handleBalanceUpdates([alice, bob, charlie], [K(42), K(17), K(3)]).encodeABI();
      const res = await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);
      expect(await amb.messageCallStatus(messageId)).to.be.true;

      const logs = await fetchLogs(PPMediatorL2, res);

      expectEvent({ logs }, 'HandleBalanceUpdates', {
        accounts: [alice, bob, charlie],
        balances: [K(42), K(17), K(3)]
      })

      expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal(K(42));
      expect(await mediatorL2.getCurrentVotes(bob)).to.be.equal(K(17));
      expect(await mediatorL2.getCurrentVotes(charlie)).to.be.equal(K(3));
    });

    it('should reject mismatching member/balance arrays', async function() {
      const data = mediatorL2.contract.methods.handleBalanceUpdates([alice, bob], [K(42), K(17), K(3)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);
      expect(await amb.messageCallStatus(messageId)).to.be.false;
      expect(decodeRevertBytes(await amb.failedMessageResponse(messageId)))
        .to.be.equal('PPMediatorL2::handleBalanceUpdates: Array lengths should match')
    });

    it('should reject updates with non-mediatorL1 origin', async function() {
      const data = mediatorL2.contract.methods.handleBalanceUpdates([alice, bob], [K(42), K(17), K(3)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, alice, data, messageId, 2000000);
      expect(await amb.messageCallStatus(messageId)).to.be.false;
      expect(decodeRevertBytes(await amb.failedMessageResponse(messageId)))
        .to.be.equal('PPMediatorL2::handleBalanceUpdates: Invalid message sender')
    });

    it('should deny non-amb calls', async function() {
      await expect(mediatorL2.handleBalanceUpdates([alice], [K(42)], { from: owner }))
        .to.be.revertedWith('PPMediatorL2::handleBalanceUpdates: Only AMB allowed');
    });
  });

  describe('getCurrentVotes', () => {
    it('should return 0 for a member with no balance', async function() {
      expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal('0');
    })

    it('should return the latest updated balance', async function() {
      expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal('0');

      // 42
      let data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(42)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);

      expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal(K(42));

      // 123
      data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(123)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);

      expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal(K(123));

      // 0
      data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(0)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);

      expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal(K(0));

      // 1
      data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(1)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);

      expect(await mediatorL2.getCurrentVotes(alice)).to.be.equal(K(1));
    })
  });

  describe('getPriorVotes', () => {
    let latestBlockInt;
    let preInitialBlock;

    beforeEach(async function() {
      latestBlockInt = (await time.latestBlock()).toNumber();
      preInitialBlock = latestBlockInt - 1;
    });

    it('should return 0 for a member with no balance', async function() {
      expect(await mediatorL2.getPriorVotes(alice, preInitialBlock)).to.be.equal('0');
    })

    it('should revert when querying about the latest block', async function() {
      await expect(mediatorL2.getPriorVotes(alice, latestBlockInt))
        .to.be.revertedWith('PPMediatorL2::getPriorVotes: not yet determined');
    })

    it('should update cache if called in the same block', async function() {
      const data = mediatorL2.contract.methods.handleBalanceUpdates([alice, bob, alice], [K(42), K(17), K(3)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);
      await time.advanceBlock();

      expect(await mediatorL2.getPriorVotes(alice, (await time.latestBlock()).toNumber() - 2)).to.be.equal(K(0));
      expect(await mediatorL2.getPriorVotes(alice, (await time.latestBlock()).toNumber() - 1)).to.be.equal(K(3));
    });

    it('should cache each balance update', async function() {
      // block 0/balance 0
      expect(await mediatorL2.getPriorVotes(alice, preInitialBlock)).to.be.equal('0');

      // +5/42
      // block +5/balance 42
      await time.advanceBlockTo(latestBlockInt + 4);
      let data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(42)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);

      expect((await time.latestBlock()).toNumber()).to.be.equal(latestBlockInt + 5)
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt)).to.be.equal(K(0));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 1)).to.be.equal(K(0));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 2)).to.be.equal(K(0));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 3)).to.be.equal(K(0));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 4)).to.be.equal(K(0));
      await expect(mediatorL2.getPriorVotes(alice, latestBlockInt + 5))
        .to.be.revertedWith('PPMediatorL2::getPriorVotes: not yet determined');

      // block +6/balance 10
      data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(10)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);

      expect((await time.latestBlock()).toNumber()).to.be.equal(latestBlockInt + 6)
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 4)).to.be.equal(K(0));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 5)).to.be.equal(K(42));
      await expect(mediatorL2.getPriorVotes(alice, latestBlockInt + 6))
        .to.be.revertedWith('PPMediatorL2::getPriorVotes: not yet determined');

      // block +8/balance 0
      await time.advanceBlock();
      data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(0)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);

      expect((await time.latestBlock()).toNumber()).to.be.equal(latestBlockInt + 8)
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 4)).to.be.equal(K(0));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 5)).to.be.equal(K(42));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 6)).to.be.equal(K(10));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 7)).to.be.equal(K(10));
      await expect(mediatorL2.getPriorVotes(alice, latestBlockInt + 8))
        .to.be.revertedWith('PPMediatorL2::getPriorVotes: not yet determined');

      // block +9/balance 1
      data = mediatorL2.contract.methods.handleBalanceUpdates([alice], [K(1)]).encodeABI();
      await amb.executeMessageCall(mediatorL2.address, mediatorL1Address, data, messageId, 2000000);

      expect((await time.latestBlock()).toNumber()).to.be.equal(latestBlockInt + 9)
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 4)).to.be.equal(K(0));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 5)).to.be.equal(K(42));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 6)).to.be.equal(K(10));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 7)).to.be.equal(K(10));
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 8)).to.be.equal(K(0));
      await expect(mediatorL2.getPriorVotes(alice, latestBlockInt + 9))
        .to.be.revertedWith('PPMediatorL2::getPriorVotes: not yet determined');

      // block +10
      await time.advanceBlock();
      expect(await mediatorL2.getPriorVotes(alice, latestBlockInt + 9)).to.be.equal(K(1));
    })
  });

  describe('owner methods', () => {
    describe('setMediatorContractOnOtherSide', async function() {
      it('should allow owner setting a new contract address', async function() {
        const res = await mediatorL2.setMediatorContractOnOtherSide(alice, { from: owner });
        expectEvent(res, 'SetMediatorContractOnOtherSide', { mediatorContractOnOtherSide: alice });
        expect(await mediatorL2.mediatorContractOnOtherSide()).to.be.equal(alice);
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL2.setMediatorContractOnOtherSide(alice, { from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });

    describe('setAmb', async function() {
      it('should allow owner setting a new amb address', async function() {
        const res = await mediatorL2.setAmb(alice, { from: owner });
        expectEvent(res, 'SetAmb', { amb: alice });
        expect(await mediatorL2.amb()).to.be.equal(alice);
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL2.setAmb(alice, { from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });

    describe('setGovernorL2Timelock', async function() {
      it('should allow the owner setting a new governors timelock address', async function() {
        const res = await mediatorL2.setGovernorL2Timelock(bob, { from: owner });
        expectEvent(res, 'SetGovernorL2Timelock', { governorL2Timelock: bob });
        expect(await mediatorL2.governorL2Timelock()).to.be.equal(bob);
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL2.setGovernorL2Timelock(alice, { from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });

    describe('setRequestGasLimit', async function() {
      it('should allow the [owner setting a new contract address', async function() {
        const res = await mediatorL2.setRequestGasLimit(42, { from: owner });
        expectEvent(res, 'SetRequestGasLimit', { requestGasLimit: '42' });
        expect(await mediatorL2.requestGasLimit()).to.be.equal('42');
      })

      it('should deny non owner calling the method', async function() {
        await expect(mediatorL2.setRequestGasLimit(alice, { from: alice }))
          .to.be.revertedWith('Ownable: caller is not the owner');
      })
    });
  });
});
