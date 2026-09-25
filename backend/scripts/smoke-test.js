/**
 * End-to-end check against a running EcoLedger API, local or deployed.
 *
 *   npm run smoke                                   (http://localhost:5000)
 *   npm run smoke -- https://your-api.onrender.com  (a deployed API)
 *
 * It registers a throwaway student, submits an activity with a photo, signs in as
 * the admin, approves it, checks that CCT really arrived on-chain, then removes the test student.
 * Admin login comes from ADMIN_EMAIL / ADMIN_PASSWORD (defaults: the local dev admin).
 */
require('dotenv').config();

const BASE = (process.argv[2] || process.env.API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/, '');
const API = `${BASE}/api`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@ecoledger.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
// 1x1 green PNG, enough to exercise the photo upload
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const bad = (msg) => { failed++; console.log(`  ✘ ${msg}`); };

async function call(path, { token, body, form, method } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, {
    method: method || (body || form ? 'POST' : 'GET'),
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status} ${data.error || ''}`.trim());
  return data;
}

async function main() {
  console.log(`\nEcoLedger smoke test against ${BASE}\n`);

  const health = await call('/health');
  health.database ? ok('API and database are up') : bad('Database is not connected');
  if (health.chain.contract) ok(`Blockchain ready: ${health.chain.symbol} at ${health.chain.address} (chain ${health.chain.chainId})`);
  else bad(`Blockchain not ready: ${health.chain.reason}`);

  const email = `smoke-${Date.now()}@example.com`;
  const { token: studentToken, user } = await call('/students/register', { body: { name: 'Smoke Test', email, password: 'smoke-test-123' } });
  /^0x[0-9a-fA-F]{40}$/.test(user.walletAddress) && !('password' in user)
    ? ok(`Registered a test student with wallet ${user.walletAddress}`)
    : bad('Registration returned an unexpected user');

  const types = await call('/activity-types');
  const type = types[0];
  const form = new FormData();
  form.append('activityType', type._id);
  form.append('description', 'Automated smoke test activity');
  form.append('location', 'Smoke test');
  form.append('proofImage', new Blob([PNG], { type: 'image/png' }), 'proof.png');
  const activity = await call('/activity', { token: studentToken, form });
  activity.pointsEarned === type.points ? ok(`Submitted "${type.name}" for ${type.points} points`) : bad('Points were not set from the activity type');

  const photo = await fetch(BASE + activity.proofImage);
  photo.ok && photo.headers.get('content-type') === 'image/png' ? ok('Proof photo is stored and served') : bad(`Proof photo not served (${photo.status})`);

  try {
    await call('/activity', { token: studentToken });
    bad('A student could list all activities (should be admin only)');
  } catch {
    ok('Admin-only routes are closed to students');
  }

  let adminToken;
  try {
    adminToken = (await call('/students/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).token;
    ok(`Signed in as admin ${ADMIN_EMAIL}`);
  } catch (e) {
    bad(`Admin sign-in failed (${e.message}). Set ADMIN_EMAIL and ADMIN_PASSWORD.`);
  }

  if (adminToken) {
    console.log('  … approving (on a public testnet the mint takes 10 to 30 seconds)');
    const { activity: approved, mint } = await call(`/activity/${activity._id}/verify`, { token: adminToken, body: { status: 'approved' } });
    approved.verificationStatus === 'approved' ? ok('Activity approved') : bad('Activity was not approved');
    if (mint?.ok) ok(`Minted ${approved.pointsEarned} CCT in tx ${mint.txHash} (block ${mint.blockNumber})`);
    else bad(`Mint failed: ${mint?.reason}`);

    try {
      await call(`/activity/${activity._id}/verify`, { token: adminToken, body: { status: 'approved' } });
      bad('The same activity could be approved twice');
    } catch {
      ok('Double approval is blocked');
    }

    const wallet = await call('/students/wallet', { token: studentToken });
    if (wallet.onChainBalance === type.points) ok(`Wallet shows ${wallet.onChainBalance} CCT read from the contract`);
    else bad(`On-chain balance is ${wallet.onChainBalance}, expected ${type.points}`);
    wallet.ecoPoints === type.points ? ok(`${wallet.ecoPoints} eco points credited`) : bad('Eco points were not credited');
  }

  // Tidy up so the test student doesn't appear on the leaderboard
  if (adminToken) {
    try {
      await call(`/students/${user._id}`, { token: adminToken, method: 'DELETE' });
      ok('Removed the test student again');
    } catch (e) {
      bad(`Could not remove the test student (${e.message})`);
    }
  }

  console.log(failed ? `\n${failed} check(s) failed.\n` : '\nAll checks passed. EcoLedger is working end to end.\n');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n  ✘ ${e.message}\n\nIs the API running at ${BASE}?\n`);
  process.exit(1);
});
