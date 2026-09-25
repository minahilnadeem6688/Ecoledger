/**
 * Session, server status and toasts, shared by every screen.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, Health, onOffline, setToken, User } from './api';
import { flushQueue, queuedCount } from './queue';

const KEY = 'ecoledger.session';

interface SessionValue {
  ready: boolean;
  user: User | null;
  health: Health | null;
  queued: number;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
  refreshHealth: () => Promise<void>;
  refreshQueue: () => Promise<void>;
  toast: (message: string, tone?: 'good' | 'bad' | 'info') => void;
  toastState: { message: string; tone: 'good' | 'bad' | 'info'; id: number } | null;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUserState] = useState<User | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [queued, setQueued] = useState(0);
  const [toastState, setToastState] = useState<SessionValue['toastState']>(null);
  const tokenRef = useRef<string | null>(null);

  const persist = async (token: string | null, u: User | null) => {
    if (token && u) await AsyncStorage.setItem(KEY, JSON.stringify({ token, user: u }));
    else await AsyncStorage.removeItem(KEY);
  };

  const toast = useCallback((message: string, tone: 'good' | 'bad' | 'info' = 'info') => {
    setToastState({ message, tone, id: Date.now() });
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await api.health());
    } catch {
      setHealth({ server: false, database: false, chain: { rpc: false, contract: false, address: null, reason: 'Server offline' } });
    }
  }, []);

  const signIn = useCallback(async (token: string, u: User) => {
    tokenRef.current = token;
    setToken(token);
    setUserState(u);
    await persist(token, u);
  }, []);

  const signOut = useCallback(async () => {
    tokenRef.current = null;
    setToken(null);
    setUserState(null);
    await persist(null, null);
  }, []);

  const setUser = useCallback((u: User) => {
    setUserState(u);
    if (tokenRef.current) persist(tokenRef.current, u);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      setUser(await api.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await signOut();
    }
  }, [setUser, signOut]);

  // Restore a saved session on launch.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          tokenRef.current = saved.token;
          setToken(saved.token);
          setUserState(saved.user);
        }
      } catch {}
      setReady(true);
      setQueued(await queuedCount());
      refreshHealth();
      if (tokenRef.current) refreshUser();
    })();
  }, [refreshHealth, refreshUser]);

  const refreshQueue = useCallback(async () => setQueued(await queuedCount()), []);

  useEffect(() => {
    // only react to the first failure; the 20s poll notices when the server is back
    onOffline(() => { setHealth((h) => (h && !h.server ? h : { server: false, database: false, chain: { rpc: false, contract: false, address: null, reason: 'Server offline' } })); });
    return () => onOffline(null);
  }, [refreshHealth]);

  // Keep an eye on the server and send any activities saved while it was offline.
  useEffect(() => {
    const t = setInterval(refreshHealth, 20000);
    return () => clearInterval(t);
  }, [refreshHealth]);
  useEffect(() => {
    if (!health?.server || !user || user.role !== 'student') return;
    (async () => {
      const sent = await flushQueue();
      setQueued(await queuedCount());
      if (sent > 0) toast(`${sent} saved ${sent === 1 ? 'activity was' : 'activities were'} sent for review.`, 'good');
    })();
  }, [health?.server, user, toast]);

  return (
    <Ctx.Provider value={{ ready, user, health, queued, signIn, signOut, refreshUser, setUser, refreshHealth, refreshQueue, toast, toastState }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
