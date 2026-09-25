/**
 * EcoLedger API client.
 *
 * The backend address is worked out automatically, so it keeps working when your
 * Wi-Fi or IP changes:
 *   1. EXPO_PUBLIC_API_URL, if set (e.g. in .env)
 *   2. on the web: the same host the app is served from, port 5000
 *   3. on a phone with Expo Go: the computer running `expo start`, port 5000
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function resolveApi(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname || 'localhost'}:5000/api`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:5000/api`;
}

export const API_URL = resolveApi();
export const API_ORIGIN = API_URL.replace(/\/api$/, '');
export const uploadUrl = (file?: string | null) => (file ? `${API_ORIGIN}/uploads/${file}` : null);

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type Role = 'student' | 'admin';
export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  ecoPoints: number;
  cctTokens: number;
  walletAddress: string;
}
export interface ActivityType { _id: string; name: string; points: number; icon?: string }
export type Status = 'pending' | 'approved' | 'rejected';
export type MintStatus = 'none' | 'minted' | 'failed';
export interface Activity {
  _id: string;
  studentId: { _id: string; name: string; email: string; walletAddress: string } | null;
  activityType: ActivityType | null;
  description?: string;
  location?: string;
  proofImage?: string | null;
  verificationStatus: Status;
  pointsEarned: number;
  rejectionReason?: string | null;
  mintStatus: MintStatus;
  mintTxHash?: string | null;
  mintBlock?: number | null;
  mintError?: string | null;
  createdAt: string;
  verifiedAt?: string;
}
export interface ChainStatus { rpc: boolean; contract: boolean; address: string | null; chainId?: number; symbol?: string; reason?: string }
export interface Health { server: boolean; database: boolean; chain: ChainStatus }
export interface Reward { _id: string; title: string; description?: string; icon?: string; pointsRequired: number; quantity: number }
export interface Redemption { _id: string; rewardId: Reward | null; redeemedAt: string }
export interface WalletInfo {
  walletAddress: string;
  onChainBalance: number | null;
  recordedTokens: number;
  ecoPoints: number;
  chain: ChainStatus;
  mints: { _id: string; activityType: { name: string } | null; pointsEarned: number; mintTxHash: string; mintBlock: number; verifiedAt: string }[];
}
export interface MintResult { ok: boolean; txHash?: string; blockNumber?: number; reason?: string }

/* ─── Request helper ────────────────────────────────────────────────────── */

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

// Lets the session re-check server status the moment a request can't get through.
let offlineListener: (() => void) | null = null;
export const onOffline = (fn: (() => void) | null) => { offlineListener = fn; };

export class ApiError extends Error {
  status: number;
  offline: boolean;
  constructor(message: string, status = 0, offline = false) {
    super(message);
    this.status = status;
    this.offline = offline;
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (!(init.body instanceof FormData) && init.body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(API_URL + path, { ...init, headers, signal: ctrl.signal });
  } catch {
    offlineListener?.();
    throw new ApiError(`Can't reach the EcoLedger server at ${API_ORIGIN}. Is "npm start" running?`, 0, true);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || data.message || `Request failed (${res.status}).`, res.status);
  return data as T;
}

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

/* ─── Endpoints ─────────────────────────────────────────────────────────── */

export const api = {
  health: () => request<Health>('/health', {}, 5000),

  register: (name: string, email: string, password: string) =>
    post<{ token: string; user: User }>('/students/register', { name, email, password }),
  login: (email: string, password: string) => post<{ token: string; user: User }>('/students/login', { email, password }),
  me: () => request<User>('/students/me'),
  leaderboard: () => request<Pick<User, '_id' | 'name' | 'ecoPoints' | 'cctTokens'>[]>('/students/leaderboard'),
  wallet: () => request<WalletInfo>('/students/wallet'),
  connectWallet: (walletAddress: string) => post<User>('/students/wallet', { walletAddress }),

  activityTypes: () => request<ActivityType[]>('/activity-types'),
  myActivities: () => request<Activity[]>('/activity/mine'),
  allActivities: (status?: Status) => request<Activity[]>(`/activity${status ? `?status=${status}` : ''}`),
  submitActivity: (form: FormData) => request<Activity>('/activity', { method: 'POST', body: form }, 60000),
  verify: (id: string, status: 'approved' | 'rejected', reason?: string) =>
    post<{ activity: Activity; mint: MintResult | null }>(`/activity/${id}/verify`, { status, reason }),
  retryMint: (id: string) => post<{ activity: Activity; mint: MintResult }>(`/activity/${id}/retry-mint`),

  rewards: () => request<Reward[]>('/rewards'),
  myRedemptions: () => request<Redemption[]>('/rewards/mine'),
  redeem: (id: string) => post<{ message: string; user: User }>(`/rewards/${id}/redeem`),
};

/* ─── Formatting ────────────────────────────────────────────────────────── */

export const shortHash = (h?: string | null, head = 6, tail = 4) => (h && h.length > head + tail + 2 ? `${h.slice(0, head)}…${h.slice(-tail)}` : h || '');

export function timeAgo(iso?: string) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
