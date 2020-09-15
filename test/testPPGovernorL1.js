const { constants, expectEvent, time } = require('@openzeppelin/test-helpers');
const { deployProxied, decodeRevertBytes, fetchLogs, createOrGetProxyAdmin, K } = require('./helpers');

const { solidity } = require('ethereum-waffle');

const chai = require('chai');
const MockAMB = artifacts.require('MockAMB');
const PPMediatorL1 = artifacts.require('PPMediatorL1');
const MockCVP = artifacts.require('MockCVP');
const Timelock = artifacts.require('MockTimelock');
const PPGovernorL1 = artifacts.require('MockPPGovernorL1');

chai.use(solidity);
const { expect } = chai;

MockCVP.numberFormat = 'String';
PPGovernorL1.numberFormat = 'String';

const TWO_DAYS = 2 * 86400;

describe('PPGovernorL1', function () {
  let cvp;
  let timelockL1;
  let governorL1;
  let mediatorL1;
  let proxyAdmin;

  let deployer, owner, timelockStub, sourceStub1, sourceStub2, sourceStub3, sourceStub4, alice, bob, charlie, nonZero;

  before(async function() {
    [deployer, owner, timelockStub, sourceStub1, sourceStub2, sourceStub3, sourceStub4, alice, bob, charlie, nonZero] = await web3.eth.getAccounts();
  });

  beforeEach(async function () {
    // cvp = await MockCVP.new(owner);
    // timelockL1 = await Timelock.new(deployer, TWO_DAYS);

    // It's ok for the test purposes use bytecode of PPGovernorL2 as PPGovernorL1
    // governorL1 = await PPGovernorL1.new(timelockL1.address, [cvp.address], constants.ZERO_ADDRESS);
    // await timelockL1.forceAdmin(governorL1.address);

    // Lock some CVPs
    // await cvp.transfer(alice, K(1000), { from: owner });
    // await cvp.transfer(bob, K(1000), { from: owner });
  });

  describe('initialization', () => {
    it('should allow initialization with a single vote source', async function() {
      governorL1 = await PPGovernorL1.new(timelockStub, [sourceStub1], constants.ZERO_ADDRESS);

      expect(await governorL1.getVoteSources()).to.have.same.members([sourceStub1]);
      expect(await governorL1.voteSourceList(0)).to.be.equal(sourceStub1);
      expect(await governorL1.voteSources(sourceStub1)).to.be.equal(true);
      expect(await governorL1.voteSources(sourceStub2)).to.be.equal(false);
    });

    it('should allow initialization with multiple vote sources', async function() {
      governorL1 = await PPGovernorL1.new(timelockStub, [sourceStub1, sourceStub2, sourceStub3], constants.ZERO_ADDRESS);

      expect(await governorL1.getVoteSources()).to.have.same.members([sourceStub1, sourceStub2, sourceStub3]);
      expect(await governorL1.voteSourceList(0)).to.be.equal(sourceStub1);
      expect(await governorL1.voteSourceList(1)).to.be.equal(sourceStub2);
      expect(await governorL1.voteSourceList(2)).to.be.equal(sourceStub3);
      expect(await governorL1.voteSources(sourceStub1)).to.be.equal(true);
      expect(await governorL1.voteSources(sourceStub2)).to.be.equal(true);
      expect(await governorL1.voteSources(sourceStub3)).to.be.equal(true);
    });

    it('should deny vote source duplication', async function() {
      await expect(PPGovernorL1.new(timelockStub, [sourceStub1, sourceStub2, sourceStub1], constants.ZERO_ADDRESS))
        .to.be.revertedWith('GovernorAlpha::_setVoteSources: vote source duplication');
    });

    it('should deny an empty vote source list', async function() {
      await expect(PPGovernorL1.new(timelockStub, [], constants.ZERO_ADDRESS))
        .to.be.revertedWith('GovernorAlpha::constructor: voteSources can\'t be empty');
    });

    it('should deny a 0-address vote source', async function() {
      await expect(PPGovernorL1.new(timelockStub, [constants.ZERO_ADDRESS], constants.ZERO_ADDRESS))
        .to.be.revertedWith('GovernorAlpha::_setVoteSources: vote source address is 0');
    });
  })

  describe('setVoteSources', () => {
    beforeEach(async function() {
      governorL1 = await PPGovernorL1.new(timelockStub, [sourceStub1], constants.ZERO_ADDRESS);
    });

    it('should correctly perform a cleanup and set a new vote source list', async function() {
      governorL1 = await PPGovernorL1.new(timelockStub, [sourceStub1], constants.ZERO_ADDRESS);
      await governorL1.setVoteSources([sourceStub2, sourceStub3, sourceStub4], { from: timelockStub })

      expect(await governorL1.getVoteSources()).to.have.same.members([sourceStub2, sourceStub3, sourceStub4]);
      expect(await governorL1.voteSourceList(0)).to.be.equal(sourceStub2);
      expect(await governorL1.voteSourceList(1)).to.be.equal(sourceStub3);
      expect(await governorL1.voteSourceList(2)).to.be.equal(sourceStub4);
      expect(await governorL1.voteSources(sourceStub1)).to.be.equal(false);
      expect(await governorL1.voteSources(sourceStub2)).to.be.equal(true);
      expect(await governorL1.voteSources(sourceStub3)).to.be.equal(true);
      expect(await governorL1.voteSources(sourceStub3)).to.be.equal(true);
    });

    it('should correctly perform a cleanup and set a new vote source list', async function() {
      governorL1 = await PPGovernorL1.new(timelockStub, [sourceStub1, sourceStub2, sourceStub3, sourceStub4], constants.ZERO_ADDRESS);
      await governorL1.setVoteSources([sourceStub2], { from: timelockStub })

      expect(await governorL1.getVoteSources()).to.have.same.members([sourceStub2]);
      expect(await governorL1.voteSourceList(0)).to.be.equal(sourceStub2);
      expect(await governorL1.voteSources(sourceStub1)).to.be.equal(false);
      expect(await governorL1.voteSources(sourceStub2)).to.be.equal(true);
      expect(await governorL1.voteSources(sourceStub3)).to.be.equal(false);
      expect(await governorL1.voteSources(sourceStub3)).to.be.equal(false);
    });

    it('should deny non-timelock address setting vote sources', async function() {
      await expect(governorL1.setVoteSources([sourceStub2], { from: deployer }))
        .to.be.revertedWith('GovernorAlpha::setVoteSources: only timelock allowed');
    });

    it('should deny vote source duplication', async function() {
      await expect(governorL1.setVoteSources([sourceStub2, sourceStub2], { from: timelockStub }))
        .to.be.revertedWith('GovernorAlpha::_setVoteSources: vote source duplication');
    });

    it('should deny an empty vote source list', async function() {
      await expect(governorL1.setVoteSources([], { from: timelockStub }))
        .to.be.revertedWith('GovernorAlpha::_setVoteSources: vote source list is empty');
    });

    it('should deny a 0-address vote source', async function() {
      await expect(governorL1.setVoteSources([constants.ZERO_ADDRESS], { from: timelockStub }))
        .to.be.revertedWith('GovernorAlpha::_setVoteSources: vote source address is 0');
    });
  })
});
