/**
 * EcoLedger — Blockchain Config (Hardhat Local)
 * Location: ecoledger/config/blockchain.js
 *
 * Uses local Hardhat node on http://127.0.0.1:8545
 * Run: npx hardhat node  (in ecoledger folder)
 * Deploy: npx hardhat run scripts/deploy.js --network localhost
 */
const { ethers } = require('ethers');

const RPC_URL = 'http://127.0.0.1:8545';
const CONTRACT_ADDR  = process.env.CONTRACT_ADDRESS  || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const OWNER_PRIV_KEY = process.env.OWNER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const ABI = [
  'function mint(address to, uint256 amount) public',
  'function balanceOf(address account) public view returns (uint256)',
];

function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

/**
 * mintTokens — mints CCT tokens to student wallet after admin approves activity.
 * @param {string} toAddress - student Ethereum wallet address
 * @param {number} amount    - number of CCT tokens to mint
 */
async function mintTokens(toAddress, amount) {
  if (!toAddress || !/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
    console.warn('⚠️  Invalid wallet address — skipping mint:', toAddress);
    return false;
  }
  try {
    const provider = getProvider();
    const wallet   = new ethers.Wallet(OWNER_PRIV_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDR, ABI, wallet);
    console.log(`⛓  Minting ${amount} CCT to ${toAddress} on Hardhat...`);
    const tx = await contract.mint(toAddress, amount);
    await tx.wait();
    console.log(`✅  Mint successful! TxHash: ${tx.hash}`);
    return true;
  } catch (err) {
    console.error('❌  mintTokens failed (is Hardhat node running?):', err.message);
    return false;
  }
}

/**
 * getBalance — reads CCT token balance for a wallet address.
 * @param {string} address - Ethereum wallet address
 */
async function getBalance(address) {
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return 0;
  try {
    const contract = new ethers.Contract(CONTRACT_ADDR, ABI, getProvider());
    const bal = await contract.balanceOf(address);
    return Number(bal.toString());
  } catch (err) {
    console.error('❌  getBalance failed (is Hardhat node running?):', err.message);
    return 0;
  }
}

module.exports = { mintTokens, getBalance };