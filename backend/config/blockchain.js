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
// MetaMask shows keys without the 0x prefix, and copy-paste can add spaces or quotes; accept all of those.
function normaliseKey(raw) {
  if (!raw) return null;
  const k = String(raw).trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');
  return /^[0-9a-fA-F]{64}$/.test(k) ? '0x' + k : k;
}
const OWNER_PRIVATE_KEY = IS_LOCAL_RPC ? DEV_OWNER_KEY : normaliseKey(process.env.OWNER_PRIVATE_KEY);

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
let wallet = null;
function getProvider() {
  if (!provider) provider = new ethers.JsonRpcProvider(RPC_URL);
  return provider;
}
function getWallet() {
  if (!wallet) wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, getProvider());
  return wallet;
}

// On Vercel several copies of the API can run at once, so a nonce cached in memory goes stale and two
// mints end up with the same nonce. Instead every mint asks the chain for the next nonce, and mints
// from this copy of the API run one at a time.
let queue = Promise.resolve();
function serial(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

// Wait this long for a receipt before handing back a "pending" result, so the request finishes well
// inside the serverless time limit. The transaction keeps going on-chain and is checked again later.
const CONFIRM_TIMEOUT_MS = Number(process.env.MINT_CONFIRM_TIMEOUT_MS) || (IS_LOCAL_RPC ? 20000 : 40000);

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
    provider = null; wallet = null; // reconnect cleanly next time
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
  const token = new ethers.Contract(address, ABI, getProvider());
  try {
    out.symbol = await token.symbol();
    out.contract = true;
  } catch {
    out.reason = 'Contract found but it is not the EcoToken. Redeploy with "npm run deploy".';
    return out;
  }

  // Can this server actually mint? It must hold the owner key and have ETH for gas.
  let minter;
  try {
    minter = getWallet().address;
  } catch {
    out.canMint = false;
    out.reason = 'OWNER_PRIVATE_KEY is not a valid private key: it should be 64 letters and numbers (0-9, a-f), with or without 0x in front. Copy it again from MetaMask (Account details, Show private key), paste it into Vercel with nothing else, and redeploy the API.';
    return out;
  }
  out.minter = minter;
  try {
    const [owner, balance] = await Promise.all([token.owner(), getProvider().getBalance(minter)]);
    out.minterEth = Number(ethers.formatEther(balance));
    if (owner.toLowerCase() !== minter.toLowerCase()) {
      out.canMint = false;
      out.reason = `The server key belongs to ${minter}, but the contract owner is ${owner}. Set OWNER_PRIVATE_KEY on the API to the key you deployed with, then redeploy the API.`;
    } else if (!IS_LOCAL_RPC && balance < ethers.parseEther('0.0005')) {
      out.canMint = false;
      out.reason = `The server wallet ${minter} has ${out.minterEth.toFixed(5)} Sepolia ETH, not enough to pay for gas. Send it test ETH from a Sepolia faucet, then press Retry mint.`;
    } else {
      out.canMint = true;
    }
  } catch {
    out.canMint = true; // couldn't check right now; let the mint itself report any problem
  }
  return out;
}

/** Turn an ethers error into a sentence an admin can act on. */
function explain(err) {
  const msg = err?.shortMessage || err?.info?.error?.message || err?.reason || err?.message || 'Mint transaction failed.';
  if (/Ownable|OwnableUnauthorizedAccount|not the owner/i.test(msg)) return 'The server key is not the contract owner. Deploy with the same OWNER_PRIVATE_KEY.';
  if (/insufficient funds/i.test(msg)) return 'The server wallet has no Sepolia ETH left for gas. Top it up from a faucet, then retry.';
  if (/nonce|replacement|already known|underpriced/i.test(msg)) return 'Another mint was using the same transaction slot. Retry in a few seconds.';
  if (/429|rate limit|too many requests|exceeded/i.test(msg)) return 'The blockchain RPC is limiting requests. Retry in a minute, or set RPC_URL to a dedicated endpoint.';
  if (/timeout|ETIMEDOUT|ECONNRESET|network|could not detect/i.test(msg)) return 'The blockchain RPC did not answer in time. Retry in a moment.';
  return msg;
}
const isNonceClash = (err) => /nonce|replacement|already known|underpriced/i.test(err?.shortMessage || err?.message || '');

/**
 * Mint CCT for one approved activity.
 * @returns {Promise<{ ok: boolean, pending?: boolean, txHash?: string, blockNumber?: number, reason?: string }>}
 *   ok: minted and confirmed. pending: sent, but not confirmed yet (check later with checkMint).
 */
async function mintReward(toAddress, amount, activityId) {
  if (!isAddress(toAddress)) return { ok: false, reason: 'Student has no valid wallet address.' };
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: 'Nothing to mint for 0 points.' };
  const st = await status();
  if (!st.rpc || !st.contract || st.canMint === false) return { ok: false, reason: st.reason };

  let tx;
  try {
    tx = await serial(async () => {
      const contract = new ethers.Contract(st.address, ABI, getWallet());
      const send = async () => {
        const nonce = await getProvider().getTransactionCount(getWallet().address, 'pending');
        const gas = await contract.reward.estimateGas(toAddress.trim(), amount, String(activityId));
        return contract.reward(toAddress.trim(), amount, String(activityId), { nonce, gasLimit: (gas * 12n) / 10n });
      };
      // If another copy of the API took this nonce a moment ago, wait a little (with jitter so the
      // copies don't collide again) and ask the chain for the next free one.
      for (let attempt = 1; ; attempt++) {
        try {
          return await send();
        } catch (err) {
          if (!isNonceClash(err) || attempt >= 5) throw err;
          await new Promise((r) => setTimeout(r, 600 * attempt + Math.random() * 900));
        }
      }
    });
  } catch (err) {
    return { ok: false, reason: explain(err) };
  }

  try {
    const receipt = await tx.wait(1, CONFIRM_TIMEOUT_MS);
    if (!receipt || receipt.status !== 1) return { ok: false, txHash: tx.hash, reason: 'The mint transaction was reverted on-chain.' };
    return { ok: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
  } catch (err) {
    if (err?.code === 'TIMEOUT') return { ok: false, pending: true, txHash: tx.hash, reason: 'Sent to the network, waiting for confirmation.' };
    return { ok: false, txHash: tx.hash, reason: explain(err) };
  }
}

/**
 * Look up a mint that was sent earlier but not confirmed yet.
 * @returns {Promise<{ state: 'minted'|'failed'|'pending'|'unknown', blockNumber?: number }>}
 */
async function checkMint(txHash) {
  if (!txHash) return { state: 'unknown' };
  try {
    const receipt = await getProvider().getTransactionReceipt(txHash);
    if (receipt) return receipt.status === 1 ? { state: 'minted', blockNumber: receipt.blockNumber } : { state: 'failed' };
    const tx = await getProvider().getTransaction(txHash);
    return { state: tx ? 'pending' : 'failed' }; // a transaction the network dropped will never confirm
  } catch {
    return { state: 'unknown' };
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

module.exports = { status, mintReward, checkMint, getBalance, newWalletAddress, isAddress, contractAddress };
