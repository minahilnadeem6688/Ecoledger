/**
 * EcoLedger: blockchain service (Hardhat local network by default)
 *
 * Start the chain and deploy once per chain start:
 *   npm run chain     (terminal 1: local Hardhat node on :8545)
 *   npm run deploy    (terminal 2: deploys CCT, writes deployments/localhost.json)
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
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || DEV_OWNER_KEY;
const DEPLOYMENT_FILE = path.join(__dirname, '..', 'deployments', `${process.env.CHAIN_NETWORK || 'localhost'}.json`);

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
async function status() {
  const address = contractAddress();
  const out = { rpc: false, contract: false, address, rpcUrl: RPC_URL };
  try {
    const net = await Promise.race([
      getProvider().getNetwork(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    out.rpc = true;
    out.chainId = Number(net.chainId);
  } catch {
    out.reason = `Blockchain node not reachable at ${RPC_URL}. Run "npm run chain".`;
    if (provider) provider.destroy();
    provider = null; signer = null; // reconnect cleanly next time
    return out;
  }
  if (!address) {
    out.reason = 'Token contract not deployed yet. Run "npm run deploy".';
    return out;
  }
  const code = await getProvider().getCode(address);
  if (!code || code === '0x') {
    out.reason = `No contract at ${address}. The chain was restarted: run "npm run deploy" again.`;
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
      reason: /Ownable|owner/i.test(reason) ? 'Backend key is not the contract owner. Redeploy with "npm run deploy".' : reason,
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
