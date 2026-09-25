const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-toolbox/network-helpers');

describe('EcoToken (CCT)', () => {
  async function deploy() {
    const [owner, student, stranger] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory('EcoToken')).deploy();
    return { token, owner, student, stranger };
  }

  it('has the right name, symbol and whole-token decimals', async () => {
    const { token } = await loadFixture(deploy);
    expect(await token.name()).to.equal('Campus Carbon Token');
    expect(await token.symbol()).to.equal('CCT');
    expect(await token.decimals()).to.equal(0);
    expect(await token.totalSupply()).to.equal(0);
  });

  it('makes the deployer the owner', async () => {
    const { token, owner } = await loadFixture(deploy);
    expect(await token.owner()).to.equal(owner.address);
  });

  it('mints a reward and records which activity it was for', async () => {
    const { token, student } = await loadFixture(deploy);
    await expect(token.reward(student.address, 25, 'activity-123'))
      .to.emit(token, 'EcoReward').withArgs(student.address, 25, 'activity-123')
      .and.to.emit(token, 'Transfer').withArgs(ethers.ZeroAddress, student.address, 25);
    expect(await token.balanceOf(student.address)).to.equal(25);
  });

  it('adds up several rewards', async () => {
    const { token, student } = await loadFixture(deploy);
    await token.reward(student.address, 25, 'a');
    await token.reward(student.address, 12, 'b');
    expect(await token.balanceOf(student.address)).to.equal(37);
    expect(await token.totalSupply()).to.equal(37);
  });

  it('refuses a zero reward', async () => {
    const { token, student } = await loadFixture(deploy);
    await expect(token.reward(student.address, 0, 'a')).to.be.revertedWith('Amount must be positive');
  });

  it('only lets the owner mint', async () => {
    const { token, student, stranger } = await loadFixture(deploy);
    await expect(token.connect(stranger).reward(student.address, 10, 'a'))
      .to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount').withArgs(stranger.address);
    await expect(token.connect(stranger).mint(stranger.address, 10))
      .to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
  });

  it('lets students transfer their tokens like any ERC-20', async () => {
    const { token, student, stranger } = await loadFixture(deploy);
    await token.reward(student.address, 30, 'a');
    await token.connect(student).transfer(stranger.address, 10);
    expect(await token.balanceOf(student.address)).to.equal(20);
    expect(await token.balanceOf(stranger.address)).to.equal(10);
  });
});
