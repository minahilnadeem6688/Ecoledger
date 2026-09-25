/**
 * EcoLedger: blockchain service.
 *
 * Local (default): a Hardhat node on :8545
 *   npm run chain     (terminal 1: local Hardhat node on :8545)
 *   npm run deploy    (terminal 2: deploys CCT, writes deployments/localhost.json)
 *
 * Public testnet (Sepolia): set RPC_URL, OWNER_PRIVATE_KEY and CONTRACT_ADDRESS.
 * See docs/DEPLOYMENT.md.
 *
 * Every function here reports *why* something failed instead of failing silently,
 * so the admin screen can show "chain offline" or "contract not deployed".
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
// Hardhat's well-known test account #0. Only valid on a local dev chain; set OWNER_PRIVATE_KEY for anything else.
const DEV_OWNER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const IS_LOCAL_RPC = /^https?:\/\/(127\.0\.0\.1|localhost|0\.0\.0\.0)(:|\/|$)/.test(RPC_URL);
// On the local chain `npm run deploy` always deploys from Hardhat account #0, so that key signs the mints
// (even if .env holds a Sepolia key for `npm run deploy:sepolia`). On a real network it must come from the environment.
const OWNER_PRIVATE_KEY = IS_LOCAL_RPC ? DEV_OWNER_KEY : process.env.OWNER_PRIVATE_KEY || null;

// Written by `npm run deploy` / `npm run deploy:sepolia`. CONTRACT_ADDRESS overrides it.
const DEPLOYMENT_FILE = path.join(__dirname, '..', 'deployments', `${process.env.CHAIN_NETWORK || (IS_LOCAL_RPC ? 'localhost' : 'sepolia')}.json`);

// Block explorers for networks EcoLedger may run on, so the app can link each mint.
const EXPLORERS = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  17000: 'https://holesky.etherscan.io',
  80002: 'https://amoy.polygonscan.com',
  84532: 'https://sepolia.basescan.org',
};

const ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function owner() view returns (address)',
  'function reward(address to, uint256 amount, string activityId)',
  'event EcoReward(address indexed student, uint256 amount, string activityId)',
];

const isAddress = (a) => typeof a === 'string' && /^0x[0-9a-fA-F]{40}$/.test(a.trim());

/** The contract address: CONTRACT_ADDRESS env wins, otherwise the file written by `npm run deploy`. */
function contractAddress() {
  if (isAddress(process.env.CONTRACT_ADDRESS || '')) return process.env.CONTRACT_ADDRESS.trim();
  try {
    const rec = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    return isAddress(rec.address) ? rec.address : null;
  } catch {
    return null;
  }
}

let provider = null;
let signer = null;
function getProvider() {
  if (!provider) provider = new ethers.JsonRpcProvider(RPC_URL);
  return provider;
}
function getSigner() {
  // NonceManager keeps nonces in order when several approvals mint back to back.
  if (!signer) signer = new ethers.NonceManager(new ethers.Wallet(OWNER_PRIVATE_KEY, getProvider()));
  return signer;
}

/**
 * Health check used by /api/health and before every mint.
 * @returns {Promise<{ rpc: boolean, contract: boolean, address: string|null, chainId?: number, symbol?: string, reason?: string }>}
 */
// Health is polled by every open app, so remember the answer briefly to stay within RPC rate limits.
let cached = null;
async function status() {
  if (cached && Date.now() - cached.at < (IS_LOCAL_RPC ? 2000 : 15000)) return cached.value;
  const value = await checkStatus();
  cached = { at: Date.now(), value };
  return value;
}

async function checkStatus() {
  const address = contractAddress();
  const out = { rpc: false, contract: false, address, network: IS_LOCAL_RPC ? 'local' : 'public' };
  try {
    const net = await Promise.race([
      getProvider().getNetwork(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), IS_LOCAL_RPC ? 3000 : 10000)),
    ]);
    out.rpc = true;
    out.chainId = Number(net.chainId);
    if (EXPLORERS[out.chainId]) out.explorerUrl = EXPLORERS[out.chainId];
  } catch {
    out.reason = IS_LOCAL_RPC ? `Blockchain node not reachable at ${RPC_URL}. Run "npm run chain".` : 'Blockchain RPC not reachable. Check RPC_URL.';
    if (provider) provider.destroy();
    provider = null; signer = null; // reconnect cleanly next time
    return out;
  }
  if (!OWNER_PRIVATE_KEY) {
    out.reason = 'OWNER_PRIVATE_KEY is not set, so the server cannot sign mint transactions.';
    return out;
  }
  if (!address) {
    out.reason = IS_LOCAL_RPC ? 'Token contract not deployed yet. Run "npm run deploy".' : 'CONTRACT_ADDRESS is not set.';
    return out;
  }
  const code = await getProvider().getCode(address);
  if (!code || code === '0x') {
    out.reason = IS_LOCAL_RPC
      ? `No contract at ${address}. The chain was restarted: run "npm run deploy" again.`
      : `No contract at ${address} on this network. Check CONTRACT_ADDRESS and RPC_URL.`;
    return out;
  }
  try {
    out.symbol = await new ethers.Contract(address, ABI, getProvider()).symbol();
    out.contract = true;
  } catch {
    out.reason = 'Contract found but it is not the EcoToken. Redeploy with "npm run deploy".';
  }
  return out;
}

/**
 * Mint CCT for one approved activity.
 * @returns {Promise<{ ok: boolean, txHash?: string, blockNumber?: number, reason?: string }>}
 */
async function mintReward(toAddress, amount, activityId) {
  if (!isAddress(toAddress)) return { ok: false, reason: 'Student has no valid wallet address.' };
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'Nothing to mint for 0 points.' };
  const st = await status();
  if (!st.rpc || !st.contract) return { ok: false, reason: st.reason };
  try {
    const contract = new ethers.Contract(st.address, ABI, getSigner());
    const tx = await contract.reward(toAddress.trim(), amount, String(activityId));
    const receipt = await tx.wait();
    return { ok: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
  } catch (err) {
    signer = null; // drop cached nonce state after a failed send
    const reason = err.shortMessage || err.reason || err.message || 'Mint transaction failed.';
    return {
      ok: false,
      reason: /Ownable|owner/i.test(reason)
        ? 'The server key is not the contract owner. Deploy with the same OWNER_PRIVATE_KEY.'
        : /insufficient funds/i.test(reason) ? 'The server wallet has no ETH left for gas. Top it up from a testnet faucet.' : reason,
    };
  }
}

/** On-chain CCT balance, or null when the chain or contract is unavailable. */
async function getBalance(address) {
  if (!isAddress(address)) return null;
  const st = await status();
  if (!st.rpc || !st.contract) return null;
  try {
    const bal = await new ethers.Contract(st.address, ABI, getProvider()).balanceOf(address.trim());
    return Number(bal);
  } catch {
    return null;
  }
}

/** A fresh address for students who have not connected their own wallet. */
function newWalletAddress() {
  return ethers.Wallet.createRandom().address;
}

module.exports = { status, mintReward, getBalance, newWalletAddress, isAddress, contractAddress };
