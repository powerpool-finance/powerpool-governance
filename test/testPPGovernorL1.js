const { constants, time } = require('@openzeppelin/test-helpers');
const { K } = require('./helpers');

const { solidity } = require('ethereum-waffle');

const chai = require('chai');
const CVP = artifacts.require('Cvp');
const PPGovernorL1 = artifacts.require('MockPPGovernorL1');

chai.use(solidity);
const { expect } = chai;

CVP.numberFormat = 'String';
PPGovernorL1.numberFormat = 'String';

describe('PPGovernorL1', function () {
  let source1;
  let governorL1;

  let owner, timelockStub, sourceStub1, sourceStub2, sourceStub3, alice, bob;

  before(async function() {
    [owner, timelockStub, sourceStub1, sourceStub2, sourceStub3, alice, bob] = await web3.eth.getAccounts();
  });

  describe('initialization', () => {
    it('should allow initialization with a single vote source', async function() {
      governorL1 = await PPGovernorL1.new(timelockStub, [sourceStub1], constants.ZERO_ADDRESS);

      expect(await governorL1.getVoteSources()).to.have.same.members([sourceStub1]);
      expect(await governorL1.voteSources(0)).to.be.equal(sourceStub1);
    });

    it('should allow initialization with multiple vote sources', async function() {
      governorL1 = await PPGovernorL1.new(timelockStub, [sourceStub1, sourceStub2, sourceStub3], constants.ZERO_ADDRESS);

      expect(await governorL1.getVoteSources()).to.have.same.members([sourceStub1, sourceStub2, sourceStub3]);
      expect(await governorL1.voteSources(0)).to.be.equal(sourceStub1);
      expect(await governorL1.voteSources(1)).to.be.equal(sourceStub2);
      expect(await governorL1.voteSources(2)).to.be.equal(sourceStub3);
    });
  })

  describe('votes calculation', async function() {

    beforeEach(async function() {
      source1 = await CVP.new(owner);
      await source1.delegate(alice, { from: alice });
    });

    it('should calculate a member votes from a single source', async function() {
      governorL1 = await PPGovernorL1.new(timelockStub, [source1.address], constants.ZERO_ADDRESS);

      await source1.transfer(alice, K(300), { from: owner });
      let latestBlock = (await time.latestBlock()).toNumber();

      await time.advanceBlock();

      expect(await source1.getPriorVotes(alice, latestBlock)).to.be.equal(K(300));
      expect(await governorL1.getPriorVotes(alice, latestBlock)).to.be.equal(K(300));
    })

    it('should calculate a member votes from multiple sources', async function() {
      const source2 = await CVP.new(owner);
      await source2.delegate(alice, { from: alice });

      const source3 = await CVP.new(owner);
      await source3.delegate(bob, { from: alice });

      governorL1 = await PPGovernorL1.new(timelockStub, [source1.address, source2.address, source3.address], constants.ZERO_ADDRESS);

      await source1.transfer(alice, K(300), { from: owner });
      await source2.transfer(alice, K(200), { from: owner });
      await source3.transfer(alice, K(100), { from: owner });
      let latestBlock = (await time.latestBlock()).toNumber();

      await time.advanceBlock();

      expect(await source1.getPriorVotes(alice, latestBlock)).to.be.equal(K(300));
      expect(await source2.getPriorVotes(alice, latestBlock)).to.be.equal(K(200));
      expect(await source3.getPriorVotes(alice, latestBlock)).to.be.equal(K(0));
      expect(await governorL1.getPriorVotes(alice, latestBlock)).to.be.equal(K(500));
    })
  });
});
