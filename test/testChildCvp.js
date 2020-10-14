const { ether } = require('@openzeppelin/test-helpers');

const { solidity } = require('ethereum-waffle');

const { advanceBlocks } = require('./helpers');

const chai = require('chai');
const ChildCvp = artifacts.require('ChildCvp');
const {web3} = ChildCvp;

chai.use(solidity);
const { expect } = chai;

ChildCvp.numberFormat = 'String';

describe.only('ChildCvp', function () {
  let cvp;

  let alice, bob, depositor;

  before(async function() {
    [alice, bob, depositor] = await web3.eth.getAccounts();
  });

  describe('initialization', () => {
    it('should allow initialization with a single vote source', async function() {
      cvp = await ChildCvp.new(depositor);

      expect(await cvp.depositor()).to.be.equal(depositor);
      expect(await cvp.totalSupply()).to.be.equal('0');
    });
  })

  describe('votes calculation', async function() {
    const depositAmount = ether('150').toString(10);
    const depositData = web3.eth.abi.encodeParameter('uint256', depositAmount);

    const doubleDepositAmount = ether('300').toString(10);

    beforeEach(async function() {
      cvp = await ChildCvp.new(depositor);
    });

    it('should calculate a member votes from a single source', async function() {
      expect(await cvp.balanceOf(alice)).to.be.equal('0');
      expect(await cvp.balanceOf(bob)).to.be.equal('0');

      const blockNumber1 = await web3.eth.getBlockNumber();

      await expect(cvp.deposit(alice, depositData, { from: alice })).to.be.revertedWith('Cvp::onlyDepositor');
      await cvp.deposit(alice, depositData, { from: depositor });

      expect(await cvp.balanceOf(alice)).to.be.equal(depositAmount);
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');

      await cvp.delegate(alice, { from: alice });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      const blockNumber2 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);

      await cvp.deposit(bob, depositData, { from: depositor });
      expect(await cvp.balanceOf(bob)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(doubleDepositAmount);
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');

      const blockNumber3 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber3)).to.be.equal('0');

      await cvp.delegate(bob, { from: bob });
      expect(await cvp.getCurrentVotes(bob)).to.be.equal(depositAmount);

      const blockNumber4 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber3)).to.be.equal('0');
      expect(await cvp.getPriorVotes(bob, blockNumber4)).to.be.equal(depositAmount);

      await cvp.delegate(alice, { from: bob });
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(doubleDepositAmount);
      expect(await cvp.totalSupply()).to.be.equal(doubleDepositAmount);

      const blockNumber5 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber3)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber3)).to.be.equal('0');
      expect(await cvp.getPriorVotes(bob, blockNumber4)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber4)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber5)).to.be.equal(doubleDepositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber5)).to.be.equal('0');

      await expect(cvp.withdraw(depositAmount, { from: bob })).to.be.revertedWith('Cvp::_moveVotes: vote amount underflows');
      await cvp.delegate(bob, { from: bob });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(depositAmount);
      expect(await cvp.getCurrentVotes(bob)).to.be.equal(depositAmount);

      const blockNumber6 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber3)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber3)).to.be.equal('0');
      expect(await cvp.getPriorVotes(bob, blockNumber4)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber4)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber5)).to.be.equal(doubleDepositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber5)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber6)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber6)).to.be.equal(depositAmount);

      await cvp.withdraw(depositAmount, { from: bob });
      expect(await cvp.balanceOf(bob)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      const blockNumber7 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber3)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber3)).to.be.equal('0');
      expect(await cvp.getPriorVotes(bob, blockNumber4)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber4)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber5)).to.be.equal(doubleDepositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber5)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber6)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber6)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber7)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber7)).to.be.equal('0');

      await cvp.withdraw(depositAmount, { from: alice });
      expect(await cvp.balanceOf(alice)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.totalSupply()).to.be.equal('0');
      await expect(cvp.withdraw(depositAmount, { from: alice })).to.be.revertedWith('Cvp::_burn: burn amount exceeds balance');

      const blockNumber8 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber3)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber3)).to.be.equal('0');
      expect(await cvp.getPriorVotes(bob, blockNumber4)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber4)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber5)).to.be.equal(doubleDepositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber5)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber6)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber6)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(alice, blockNumber7)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber7)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber8)).to.be.equal('0');
      expect(await cvp.getPriorVotes(bob, blockNumber8)).to.be.equal('0');
    })
  });
});
