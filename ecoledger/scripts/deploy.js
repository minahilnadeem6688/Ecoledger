const { ethers } = require("hardhat");

async function main() {

  const Token = await ethers.getContractFactory("EcoToken");

  const token = await Token.deploy();

  await token.waitForDeployment();

  console.log("Contract deployed at:", token.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});