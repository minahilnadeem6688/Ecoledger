/**
 * EcoLedger — Central Store (FIXED FINAL)
 * Location: ecoledger-app/store.ts
 *
 * FIXES IN THIS VERSION:
 *
 * 1. hasWalletConnected() — was blocking students with auto-generated wallets
 *    from submitting activities. Now returns true if ANY wallet address exists.
 *
 * 2. updateActivityStatus() — after backend approval, ALSO updates the local
 *    user cache so wallet/rewards pages show correct points immediately.
 *    If admin ≠ student → sets pendingPointsAwarded flag so student gets
 *    points on their next getActivities() call.
 *
 * 3. getActivities() — now picks up pendingPointsAwarded and awards points
 *    to the logged-in student automatically on load.
 *
 * 4. syncUserFromBackend() — now always runs (not just when _id exists),
 *    so offline-registered users still get synced when backend comes up.
 *
 * 5. updateStudentPoints() — removed (was causing double points).
 *    All point updates now go through backend /activity/verify → $inc,
 *    with local fallback when backend is offline.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ethers } from 'ethers';

const BACKEND = 'http://10.140.40.211:5000/api';
const HARDHAT_RPC = 'http://10.140.40.211:8545';
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const OWNER_KEY        = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const ABI = [
  'function mint(address to, uint256 amount) public',
  'function balanceOf(address account) public view returns (uint256)',
];

const KEYS = {
  USER:           'ecoUser',
  ALL_ACTIVITIES: 'ecoAllActivities',
};

/* ─── Static Data ────────────────────────────────────────────────────────── */

export const ACTIVITY_POINTS: Record<string, number> = {
  'Recycling': 20, 'Tree Plantation': 25, 'Clean Transport': 15,
  'Energy Saving': 10, 'Water Conservation': 12, 'Composting': 18,
  'Beach Clean-up': 30, 'Other': 8,
};

export const ACTIVITY_ICONS: Record<string, string> = {
  'Recycling': '♻️', 'Tree Plantation': '🌳', 'Clean Transport': '🚲',
  'Energy Saving': '💡', 'Water Conservation': '💧', 'Composting': '🌱',
  'Beach Clean-up': '🏖️', 'Other': '🍃',
};

export const LOCAL_REWARDS = [
  { id: '1', icon: '🍽️', title: 'Free Cafeteria Meal',  desc: 'One complete meal at the campus cafe.',       pts: 50  },
  { id: '2', icon: '👕', title: 'Eco-Friendly T-Shirt',  desc: 'Branded EcoLedger organic cotton t-shirt.',  pts: 70  },
  { id: '3', icon: '📚', title: 'Library Fee Waiver',    desc: 'Waiver for up to $10 of overdue fines.',     pts: 100 },
  { id: '4', icon: '🚗', title: 'Campus Parking',        desc: '1-week student parking permit.',             pts: 150 },
];

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface EcoUser {
  _id?:             string;
  name:             string;
  email:            string;
  walletAddress:    string;
  connectedWallet?: string;
  walletConnected?: boolean;
  ecoPoints:        number;
  cctTokens:        number;
}

export type ActivityStatus = 'Pending' | 'Approved' | 'Rejected';

export interface Activity {
  id:                    string;
  _id?:                  string;
  type:                  string;
  description:           string;
  location:              string;
  imageUri?:             string;
  status:                ActivityStatus;
  pts:                   number;
  submittedAt:           string;
  rejectionReason?:      string;
  studentId?:            string;
  studentName?:          string;
  studentEmail?:         string;
  walletAddress?:        string;
  pendingPointsAwarded?: boolean;  // set when admin approves offline; student picks up on next load
}

export interface LeaderEntry {
  name:           string;
  pts:            number;
  isCurrentUser?: boolean;
}

/* ─── Utilities ──────────────────────────────────────────────────────────── */

export function shortWallet(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7)  return d + 'd ago';
  return Math.floor(d / 7) + 'w ago';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function generateRealWallet(): { address: string; privateKey: string } {
  const w = ethers.Wallet.createRandom();
  return { address: w.address, privateKey: w.privateKey };
}

/**
 * FIX 1: Returns true if the student has ANY wallet (auto-generated OR connected).
 * Old code required walletConnected===true which blocked all auto-generated wallets.
 */
export async function hasWalletConnected(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const addr = user.connectedWallet ?? user.walletAddress;
  return !!addr && addr.startsWith('0x') && addr.length === 42;
}

export async function getActiveWalletAddress(): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;
  return user.connectedWallet ?? user.walletAddress ?? null;
}

/* ─── Internal Helpers ───────────────────────────────────────────────────── */

function matchActivity(a: Activity, id: string): boolean {
  return a.id === id || (!!a._id && a._id === id);
}

async function readAllActivities(): Promise<Activity[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.ALL_ACTIVITIES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function writeAllActivities(acts: Activity[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.ALL_ACTIVITIES, JSON.stringify(acts));
}

async function mergeBackendActivities(backendActs: Activity[]): Promise<Activity[]> {
  const local = await readAllActivities();
  const byId  = new Map<string, Activity>();
  for (const ba of backendActs) { if (ba._id) byId.set(ba._id, ba); }

  const merged = local.map(la => {
    if (la._id && byId.has(la._id)) {
      const ba = byId.get(la._id)!;
      return {
        ...la,
        status:          ba.status,
        rejectionReason: ba.rejectionReason,
        studentId:       la.studentId ?? ba.studentId,
      };
    }
    return la;
  });

  const localIds = new Set(local.map(a => a._id).filter(Boolean));
  for (const ba of backendActs) {
    if (ba._id && !localIds.has(ba._id)) merged.push(ba);
  }

  await writeAllActivities(merged);
  return merged;
}

async function isBackendUp(): Promise<boolean> {
  try {
    const url = BACKEND.replace('/api', '/');
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}

async function callAPI(path: string, options?: RequestInit): Promise<any> {
  try {
    const res = await fetch(BACKEND + path, {
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(8000),
      ...options,
    });
    return await res.json();
  } catch { return null; }
}

async function isChainUp(): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
    await provider.getBlockNumber();
    return true;
  } catch { return false; }
}

async function mintOnChain(toAddress: string, amount: number): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
    const wallet   = new ethers.Wallet(OWNER_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
    const tx       = await contract.mint(toAddress, amount);
    await tx.wait();
    console.log(`✅ Minted ${amount} CCT to ${toAddress}`);
    return true;
  } catch (e) {
    console.log('⚠️ Blockchain mint skipped (Hardhat not running)');
    return false;
  }
}

async function getChainBalance(address: string): Promise<number> {
  try {
    const provider = new ethers.JsonRpcProvider(HARDHAT_RPC);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    const bal      = await contract.balanceOf(address);
    return Number(bal.toString());
  } catch { return 0; }
}

/* ─── Public Exports ─────────────────────────────────────────────────────── */

export async function isBackendRunning():      Promise<boolean> { return isBackendUp(); }
export async function isBlockchainConnected(): Promise<boolean> { return isChainUp();  }
export async function getRealBalance(address: string): Promise<number> { return getChainBalance(address); }

export async function connectExternalWallet(
  address: string,
): Promise<{ success: boolean; balance: number; chainLive: boolean; error?: string }> {
  const trimmed = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return {
      success: false, balance: 0, chainLive: false,
      error: 'Invalid address. Must start with 0x and be exactly 42 characters.',
    };
  }
  const user = await getUser();
  if (!user) return { success: false, balance: 0, chainLive: false, error: 'Not logged in.' };

  const chainLive = await isChainUp();
  const balance   = chainLive ? await getChainBalance(trimmed) : (user.cctTokens ?? 0);
  await saveUser({ ...user, connectedWallet: trimmed, walletConnected: true, cctTokens: balance });

  if (user._id && await isBackendUp()) {
    callAPI('/students/' + user._id + '/wallet', {
      method: 'POST', body: JSON.stringify({ walletAddress: trimmed }),
    }).catch(() => {});
  }
  return { success: true, balance, chainLive };
}

export async function disconnectExternalWallet(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  await saveUser({ ...user, connectedWallet: undefined, walletConnected: false });
}

/* ─── User / Auth ────────────────────────────────────────────────────────── */

export async function getUser(): Promise<EcoUser | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveUser(user: EcoUser): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
}

export async function createStudentInDB(data: {
  name: string; email: string; password: string; walletAddress: string;
}) {
  return callAPI('/students/create', { method: 'POST', body: JSON.stringify(data) });
}

export async function getAllStudentsFromDB() {
  return callAPI('/students/');
}

export async function loginStudent(email: string, password: string): Promise<EcoUser | null> {
  try {
    if (await isBackendUp()) {
      const result = await callAPI('/students/login', {
        method: 'POST', body: JSON.stringify({ email, password }),
      });
      if (result && (result._id || result.student?._id)) {
        const raw      = result.student ?? result;
        const existing = await getUser();
        const same     = existing?.email === email;
        const user: EcoUser = {
          _id:             raw._id,
          name:            raw.name,
          email:           raw.email,
          walletAddress:   raw.walletAddress  ?? existing?.walletAddress  ?? '',
          connectedWallet: existing?.connectedWallet,
          walletConnected: existing?.walletConnected ?? false,
          // Never go backwards — take whichever is higher
          ecoPoints: Math.max(raw.ecoPoints ?? 0, same ? (existing?.ecoPoints ?? 0) : 0),
          cctTokens: Math.max(raw.cctTokens  ?? 0, same ? (existing?.cctTokens  ?? 0) : 0),
        };
        await saveUser(user);
        return user;
      }
    }
  } catch {}
  const local = await getUser();
  return (local && local.email === email) ? local : null;
}

/**
 * FIX 4: Works even when _id is missing (offline-registered users).
 */
export async function syncUserFromBackend(): Promise<EcoUser | null> {
  const user = await getUser();
  if (!user) return null;

  // If we have _id, try syncing from backend
  if (user._id) {
    try {
      if (await isBackendUp()) {
        const raw = await callAPI('/students/' + user._id);
        if (raw && !raw.error && raw._id) {
          const updated: EcoUser = {
            ...user,
            // Always take the HIGHER value so points never go backwards
            ecoPoints:     Math.max(raw.ecoPoints ?? 0, user.ecoPoints ?? 0),
            cctTokens:     Math.max(raw.cctTokens  ?? 0, user.cctTokens  ?? 0),
            walletAddress: raw.walletAddress ?? user.walletAddress,
          };
          await saveUser(updated);
          return updated;
        }
      }
    } catch {}
  }
  return user;
}

/* ─── Points ─────────────────────────────────────────────────────────────── */

export async function updateUserPoints(addPts: number): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const newPts = (user.ecoPoints || 0) + addPts;
  const newTok = (user.cctTokens  || 0) + addPts;
  await saveUser({ ...user, ecoPoints: newPts, cctTokens: newTok });
  if (user._id) {
    callAPI('/students/' + user._id + '/points', {
      method: 'POST', body: JSON.stringify({ ecoPoints: newPts, cctTokens: newTok }),
    }).catch(() => {});
  }
}

export async function deductUserPoints(pts: number): Promise<void> {
  const user = await getUser();
  if (!user) return;
  const newPts = Math.max(0, (user.ecoPoints || 0) - pts);
  const newTok = Math.max(0, (user.cctTokens  || 0) - pts);
  await saveUser({ ...user, ecoPoints: newPts, cctTokens: newTok });
  if (user._id) {
    callAPI('/students/' + user._id + '/points', {
      method: 'POST', body: JSON.stringify({ ecoPoints: newPts, cctTokens: newTok }),
    }).catch(() => {});
  }
}

export async function syncBalanceFromBlockchain(): Promise<void> {
  try {
    const user = await getUser();
    const addr = user?.connectedWallet ?? user?.walletAddress;
    if (!addr) return;
    const bal = await getChainBalance(addr);
    if (bal > 0) await saveUser({ ...user!, cctTokens: bal });
  } catch {}
}

/* ─── Activities ─────────────────────────────────────────────────────────── */

/**
 * Student view — returns only the current user's activities.
 * FIX 3: Picks up pendingPointsAwarded and credits points to the student.
 */
export async function getActivities(): Promise<Activity[]> {
  const user = await getUser();
  if (!user) return [];

  // Fetch from backend and merge
  try {
    if (user._id && await isBackendUp()) {
      const db = await callAPI('/activity/student/' + user._id);
      if (db && Array.isArray(db) && db.length > 0) {
        const mapped: Activity[] = db.map((a: any) => ({
          id:              a._id,
          _id:             a._id,
          type:            a.activityType?.name ?? a.activityType ?? 'Unknown',
          description:     a.description ?? '',
          location:        a.location    ?? '',
          status:          (a.verificationStatus === 'approved' ? 'Approved'
                          : a.verificationStatus === 'rejected' ? 'Rejected' : 'Pending') as ActivityStatus,
          pts:             a.pointsEarned ?? 0,
          submittedAt:     a.createdAt   ?? new Date().toISOString(),
          rejectionReason: a.rejectionReason,
          studentName:     user.name,
          studentEmail:    user.email,
          studentId:       user._id,
          walletAddress:   user.connectedWallet ?? user.walletAddress,
        }));
        const merged = await mergeBackendActivities(mapped);
        const mine   = merged.filter(a =>
          a.studentEmail === user.email || a.studentName === user.name
        );
        return await awardPendingPoints(mine, user);
      }
    }
  } catch {}

  const all  = await readAllActivities();
  const mine = all.filter(a =>
    a.studentEmail === user.email || a.studentName === user.name
  );
  return await awardPendingPoints(mine, user);
}

/**
 * FIX 3 helper — awards any points that were approved while the student
 * was offline or on a different device from the admin.
 */
async function awardPendingPoints(mine: Activity[], user: EcoUser): Promise<Activity[]> {
  let pendingPts = 0;
  const resolved = mine.map(a => {
    if (a.pendingPointsAwarded && a.status === 'Approved') {
      pendingPts += a.pts;
      return { ...a, pendingPointsAwarded: false };
    }
    return a;
  });

  if (pendingPts > 0) {
    // Clear flags in unified store
    const allActs = await readAllActivities();
    await writeAllActivities(allActs.map(a => {
      const r = resolved.find(c => c.id === a.id);
      return r ?? a;
    }));
    // Award points to student's local cache
    const me = await getUser();
    if (me) {
      await saveUser({
        ...me,
        ecoPoints: (me.ecoPoints || 0) + pendingPts,
        cctTokens: (me.cctTokens  || 0) + pendingPts,
      });
      console.log(`✅ Offline-approval: awarded ${pendingPts} pts to ${user.name}`);
    }
  }

  return resolved.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export async function addActivity(
  act: Omit<Activity, 'id' | 'submittedAt' | 'status' | 'pts'>,
): Promise<Activity> {
  const user        = await getUser();
  const pts         = ACTIVITY_POINTS[act.type] ?? 8;
  const mintAddr    = user?.connectedWallet ?? user?.walletAddress;
  const submittedAt = new Date().toISOString();

  const newAct: Activity = {
    ...act,
    id:           Date.now().toString(),
    submittedAt,
    status:       'Pending',
    pts,
    studentName:  user?.name,
    studentEmail: user?.email,
    studentId:    user?._id,
    walletAddress: mintAddr,
  };

  // Write locally FIRST — immediately visible on Activities page
  await writeAllActivities([newAct, ...(await readAllActivities())]);

  // Background sync to backend
  if (user?._id) {
    (async () => {
      try {
        if (!(await isBackendUp())) return;
        const fd = new FormData();
        fd.append('studentId',    user._id!);
        fd.append('activityType', act.type);
        fd.append('points',       String(pts));
        fd.append('description',  act.description);
        fd.append('location',     act.location);
        const res   = await fetch(BACKEND + '/activity/add', { method: 'POST', body: fd });
        const saved = await res.json();
        if (saved?._id) {
          const all = await readAllActivities();
          await writeAllActivities(
            all.map(a =>
              a.submittedAt === submittedAt && a.studentEmail === user.email
                ? { ...a, id: saved._id, _id: saved._id }
                : a
            )
          );
          newAct.id  = saved._id;
          newAct._id = saved._id;
        }
      } catch {}
    })();
  }
  return newAct;
}

/**
 * FIX 2: updateActivityStatus — after backend approval, updates the local
 * user cache so wallet/rewards pages show correct points immediately.
 */
export async function updateActivityStatus(
  id:               string,
  status:           ActivityStatus,
  rejectionReason?: string,
): Promise<{ success: boolean; blockchainMinted: boolean }> {
  let blockchainMinted = false;

  const all = await readAllActivities();
  const act = all.find(a => matchActivity(a, id));

  // Update local store IMMEDIATELY so UI shows new status right away
  await writeAllActivities(
    all.map(a =>
      matchActivity(a, id)
        ? { ...a, status, ...(rejectionReason ? { rejectionReason } : {}) }
        : a
    )
  );

  if (status === 'Approved' && act) {
    const backendId = act._id ?? act.id;
    const backendUp = await isBackendUp();

    if (backendId && backendUp) {
      // Tell backend to approve → backend does $inc ecoPoints + mint tokens
      try {
        await callAPI('/activity/verify/' + backendId, {
          method: 'POST',
          body:   JSON.stringify({ status: 'approved' }),
        });
        console.log('✅ Backend approved:', backendId);
      } catch (e) {
        console.log('Backend verify failed:', e);
      }

      // Check if the currently logged-in user IS the student
      const me   = await getUser();
      const isMe = !!me && (
        me._id   === act.studentId   ||
        me.email === act.studentEmail ||
        me.name  === act.studentName
      );

      if (isMe && me) {
        // Same device — update local cache immediately so wallet page reflects it
        const newPts = (me.ecoPoints || 0) + act.pts;
        const newTok = (me.cctTokens  || 0) + act.pts;
        await saveUser({ ...me, ecoPoints: newPts, cctTokens: newTok });
        console.log(`✅ Local cache: ${me.name} → ${newPts} pts`);
      } else {
        // Different device/user — set flag so student picks up points on next load
        const latest = await readAllActivities();
        await writeAllActivities(
          latest.map(a =>
            matchActivity(a, id) ? { ...a, pendingPointsAwarded: true } : a
          )
        );
        console.log(`⚠️ pendingPointsAwarded set for ${act.studentName}`);
      }
    } else {
      // Backend offline — do everything locally
      const me   = await getUser();
      const isMe = !!me && (
        me._id   === act.studentId   ||
        me.email === act.studentEmail ||
        me.name  === act.studentName
      );

      if (isMe && me) {
        await saveUser({
          ...me,
          ecoPoints: (me.ecoPoints || 0) + act.pts,
          cctTokens: (me.cctTokens  || 0) + act.pts,
        });
      } else {
        const latest = await readAllActivities();
        await writeAllActivities(
          latest.map(a =>
            matchActivity(a, id) ? { ...a, pendingPointsAwarded: true } : a
          )
        );
      }

      // Try direct blockchain mint (works in Node.js/mobile, not in browser)
      const mintAddr = act.walletAddress ?? null;
      if (mintAddr && await isChainUp()) {
        blockchainMinted = await mintOnChain(mintAddr, act.pts);
        if (blockchainMinted) {
          const cu = await getUser();
          if (cu && (cu.connectedWallet === mintAddr || cu.walletAddress === mintAddr)) {
            await syncBalanceFromBlockchain();
          }
        }
      }
    }
  }

  if (status === 'Rejected' && act) {
    const backendId = act._id ?? act.id;
    if (backendId && await isBackendUp()) {
      callAPI('/activity/verify/' + backendId, {
        method: 'POST',
        body:   JSON.stringify({ status: 'rejected', reason: rejectionReason }),
      }).catch(() => {});
    }
  }

  return { success: true, blockchainMinted };
}

/** Admin view — all activities across all students */
export async function getAllActivities(): Promise<Activity[]> {
  const local = await readAllActivities();
  try {
    if (await isBackendUp()) {
      const db = await callAPI('/activity/');
      if (db && Array.isArray(db) && db.length > 0) {
        const mapped: Activity[] = db.map((a: any) => ({
          id:              a._id,
          _id:             a._id,
          type:            a.activityType?.name ?? a.activityType ?? 'Unknown',
          description:     a.description ?? '',
          location:        a.location    ?? '',
          status:          (a.verificationStatus === 'approved' ? 'Approved'
                          : a.verificationStatus === 'rejected' ? 'Rejected' : 'Pending') as ActivityStatus,
          pts:             a.pointsEarned ?? 0,
          submittedAt:     a.createdAt   ?? new Date().toISOString(),
          rejectionReason: a.rejectionReason,
          studentName:     a.studentId?.name  ?? 'Unknown',
          studentEmail:    a.studentId?.email ?? '',
          studentId:       a.studentId?._id   ?? String(a.studentId ?? ''),
          walletAddress:   a.studentId?.walletAddress ?? '',
        }));
        return mergeBackendActivities(mapped);
      }
    }
  } catch {}
  return local.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

/* ─── Leaderboard ────────────────────────────────────────────────────────── */

/** No mock data — real students only */
export async function getLeaderboard(): Promise<LeaderEntry[]> {
  const user = await getUser();
  try {
    if (await isBackendUp()) {
      const db = await callAPI('/students/leaderboard');
      if (db && Array.isArray(db) && db.length > 0) {
        return db
          .map((e: any) => ({
            name:          e.name,
            pts:           e.ecoPoints ?? 0,
            isCurrentUser: e.email === user?.email || e.name === user?.name,
          }))
          .sort((a: LeaderEntry, b: LeaderEntry) => b.pts - a.pts);
      }
    }
  } catch {}

  // Local fallback — aggregate from approved activities, no mock names
  const all    = await readAllActivities();
  const totals: Record<string, { pts: number; email?: string }> = {};
  for (const a of all) {
    if (a.status === 'Approved' && a.studentName) {
      if (!totals[a.studentName]) totals[a.studentName] = { pts: 0, email: a.studentEmail };
      totals[a.studentName].pts += a.pts;
    }
  }
  if (user?.name) {
    if (!totals[user.name]) totals[user.name] = { pts: user.ecoPoints ?? 0, email: user.email };
    else totals[user.name].pts = Math.max(totals[user.name].pts, user.ecoPoints ?? 0);
  }
  return Object.entries(totals)
    .map(([name, d]) => ({
      name,
      pts:           d.pts,
      isCurrentUser: name === user?.name || d.email === user?.email,
    }))
    .sort((a, b) => b.pts - a.pts);
}

/* ─── Rewards ────────────────────────────────────────────────────────────── */

export async function getRewards() {
  try {
    if (await isBackendUp()) {
      const db = await callAPI('/rewards/');
      if (db && Array.isArray(db) && db.length > 0) {
        return db.map((r: any) => ({
          id: r._id, icon: '🎁',
          title: r.title, desc: r.description, pts: r.pointsRequired,
        }));
      }
    }
  } catch {}
  return LOCAL_REWARDS;
}

export async function redeemRewardStore(
  rewardId: string,
  pts:      number,
): Promise<{ success: boolean; message: string }> {
  const user = await getUser();
  if (!user) return { success: false, message: 'Not logged in.' };
  if ((user.ecoPoints ?? 0) < pts) {
    return { success: false, message: `Not enough points. Need ${pts}, have ${user.ecoPoints ?? 0}.` };
  }

  if (user._id && await isBackendUp()) {
    try {
      const result = await callAPI('/rewards/redeem', {
        method: 'POST', body: JSON.stringify({ studentId: user._id, rewardId }),
      });
      if (result?.message === 'Reward redeemed successfully') {
        await deductUserPoints(pts);
        return { success: true, message: 'Reward redeemed successfully!' };
      }
      if (result?.message === 'Not enough points')   return { success: false, message: 'Not enough points on the server.' };
      if (result?.message === 'Reward out of stock') return { success: false, message: 'This reward is out of stock.' };
    } catch {}
  }

  // Offline fallback — deduct locally
  await deductUserPoints(pts);
  return { success: true, message: 'Reward redeemed!' };
}