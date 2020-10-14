const { ether } = require('@openzeppelin/test-helpers');

const { solidity } = require('ethereum-waffle');

const { advanceBlocks } = require('./helpers');

const chai = require('chai');
const ChildCvp = artifacts.require('ChildCvp');
const {web3} = ChildCvp;

chai.use(solidity);
const { expect } = chai;

ChildCvp.numberFormat = 'String';

describe('ChildCvp', function () {
  let cvp;

  let alice, bob, dan, depositor;

  before(async function() {
    [alice, bob, dan, depositor] = await web3.eth.getAccounts();
  });

  describe('initialization', () => {
    it('should allow initialization with a single vote source', async function() {
      cvp = await ChildCvp.new(depositor);

      expect(await cvp.depositor()).to.be.equal(depositor);
      expect(await cvp.totalSupply()).to.be.equal('0');
    });
  })

  describe('cvp deposit and withdraw', async function() {
    const depositAmount = ether('150').toString(10);
    const depositData = web3.eth.abi.encodeParameter('uint256', depositAmount);

    const doubleDepositAmount = ether('300').toString(10);
    const trippleDepositAmount = ether('450').toString(10);

    beforeEach(async function() {
      cvp = await ChildCvp.new(depositor);
    });

    it('should correctly deposit and withdraw delegated or non-delegated balance', async function() {
      expect(await cvp.balanceOf(alice)).to.be.equal('0');
      expect(await cvp.balanceOf(bob)).to.be.equal('0');

      const blockNumber1 = await web3.eth.getBlockNumber();

      //unauthorized deposit
      await expect(cvp.deposit(alice, depositData, { from: alice })).to.be.revertedWith('Cvp::onlyDepositor');

      //deposit to first user
      await cvp.deposit(alice, depositData, { from: depositor });

      expect(await cvp.balanceOf(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');

      // withdraw and deposit again without delegates
      await cvp.withdraw(depositAmount, { from: alice });
      expect(await cvp.balanceOf(alice)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.totalSupply()).to.be.equal('0');
      await cvp.deposit(alice, depositData, { from: depositor });
      expect(await cvp.balanceOf(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      //delegate deposited balance to self
      await cvp.delegate(alice, { from: alice });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      //deposit while already delegated to self
      await cvp.deposit(alice, depositData, { from: depositor });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(doubleDepositAmount);
      expect(await cvp.totalSupply()).to.be.equal(doubleDepositAmount);
      await cvp.delegate(alice, { from: alice });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(doubleDepositAmount);

      // withdraw part of delegated balance
      await cvp.withdraw(depositAmount, { from: alice });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      const blockNumber2 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);

      //deposit to second user
      await cvp.deposit(bob, depositData, { from: depositor });
      expect(await cvp.balanceOf(bob)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(doubleDepositAmount);
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');

      const blockNumber3 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber3)).to.be.equal('0');

      //delegate deposited balance to self
      await cvp.delegate(bob, { from: bob });
      expect(await cvp.getCurrentVotes(bob)).to.be.equal(depositAmount);

      const blockNumber4 = await web3.eth.getBlockNumber();
      await advanceBlocks(1);
      expect(await cvp.getPriorVotes(alice, blockNumber1)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber2)).to.be.equal(depositAmount);
      expect(await cvp.getPriorVotes(bob, blockNumber3)).to.be.equal('0');
      expect(await cvp.getPriorVotes(bob, blockNumber4)).to.be.equal(depositAmount);

      //re-delegate deposited balance to another user
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

      // deposit while already delegated to another user
      await cvp.deposit(bob, depositData, { from: depositor });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(trippleDepositAmount);
      expect(await cvp.totalSupply()).to.be.equal(trippleDepositAmount);
      await cvp.delegate(alice, { from: bob });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(trippleDepositAmount);

      // withdraw part of delegated balance and delegate rest balance to another user again
      await cvp.withdraw(depositAmount, { from: bob });
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(doubleDepositAmount);
      expect(await cvp.totalSupply()).to.be.equal(doubleDepositAmount);

      //withdraw delegated to self balance
      await cvp.withdraw(depositAmount, { from: bob });
      expect(await cvp.balanceOf(bob)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

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
      expect(await cvp.getPriorVotes(bob, blockNumber6)).to.be.equal('0');

      await cvp.withdraw(depositAmount, { from: alice });
      expect(await cvp.balanceOf(alice)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.totalSupply()).to.be.equal('0');
      await expect(cvp.withdraw(depositAmount, { from: alice })).to.be.revertedWith('Cvp::_burn: burn amount exceeds balance');

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
      expect(await cvp.getPriorVotes(bob, blockNumber6)).to.be.equal('0');
      expect(await cvp.getPriorVotes(alice, blockNumber7)).to.be.equal('0');
      expect(await cvp.getPriorVotes(bob, blockNumber7)).to.be.equal('0');

      await cvp.deposit(bob, depositData, { from: depositor });
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);
      await cvp.delegate(bob, { from: bob });
      expect(await cvp.getCurrentVotes(bob)).to.be.equal(depositAmount);
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      await cvp.transfer(alice, depositAmount, { from: bob });
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      await cvp.withdraw(depositAmount, { from: alice });
      expect(await cvp.balanceOf(alice)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.totalSupply()).to.be.equal('0');

      await cvp.deposit(dan, depositData, { from: depositor });
      expect(await cvp.balanceOf(dan)).to.be.equal(depositAmount);
      expect(await cvp.getCurrentVotes(dan)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      await cvp.transfer(bob, depositAmount, { from: dan });
      expect(await cvp.balanceOf(dan)).to.be.equal('0');
      expect(await cvp.balanceOf(bob)).to.be.equal(depositAmount);
      expect(await cvp.getCurrentVotes(dan)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(alice)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(bob)).to.be.equal(depositAmount);
      expect(await cvp.totalSupply()).to.be.equal(depositAmount);

      await expect(cvp.withdraw(depositAmount, { from: dan })).to.be.revertedWith('Cvp::_burn: burn amount exceeds balance');

      await cvp.withdraw(depositAmount, { from: bob });
      expect(await cvp.balanceOf(bob)).to.be.equal('0');
      expect(await cvp.getCurrentVotes(bob)).to.be.equal('0');
      expect(await cvp.totalSupply()).to.be.equal('0');
    })
  });
});
