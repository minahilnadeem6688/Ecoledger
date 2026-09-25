/**
 * Deploys EcoToken (CCT) and records its address in deployments/<network>.json.
 *   npm run deploy            local chain (after `npm run chain`)
 *   npm run deploy:sepolia    Sepolia testnet (needs OWNER_PRIVATE_KEY with test ETH)
 */
const fs = require('fs');
const path = require('path');
const { ethers, network } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const Token = await ethers.getContractFactory('EcoToken');
  const token = await Token.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  const { chainId } = await ethers.provider.getNetwork();
  const record = {
    address,
    chainId: Number(chainId),
    network: network.name,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const dir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(record, null, 2));

  console.log(`EcoToken (CCT) deployed at ${address} on ${network.name} (chain ${chainId})`);
  console.log(`Owner (the key that signs mints): ${deployer.address}`);
  console.log(`Saved to deployments/${network.name}.json.`);
  if (network.name === 'localhost') {
    console.log('Restart the backend to pick it up.');
  } else {
    console.log(`\nNext: set CONTRACT_ADDRESS=${address} on your server, and use the same OWNER_PRIVATE_KEY there.`);
    console.log(`Optional: npx hardhat verify --network ${network.name} ${address}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
