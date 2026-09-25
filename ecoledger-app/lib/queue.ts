/**
 * Offline resilience: if the server can't be reached when a student submits an
 * activity, it is saved on the device and sent automatically once the server is back.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api, ApiError } from './api';

const KEY = 'ecoledger.queue';

export interface Draft {
  activityType: string;
  typeName: string;
  description: string;
  location: string;
  imageUri?: string | null;
  savedAt: string;
}

async function read(): Promise<Draft[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
  } catch {
    return [];
  }
}

export async function queueDraft(d: Draft) {
  const all = await read();
  all.push(d);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function queuedCount() {
  return (await read()).length;
}

export async function buildForm(d: Omit<Draft, 'savedAt' | 'typeName'>): Promise<FormData> {
  const form = new FormData();
  form.append('activityType', d.activityType);
  form.append('description', d.description);
  form.append('location', d.location);
  if (d.imageUri) {
    if (Platform.OS === 'web') {
      try {
        const blob = await (await fetch(d.imageUri)).blob();
        form.append('proofImage', blob, 'proof.jpg');
      } catch {
        // the image is no longer available (e.g. the tab was closed); send without it
      }
    } else {
      form.append('proofImage', { uri: d.imageUri, name: 'proof.jpg', type: 'image/jpeg' } as any);
    }
  }
  return form;
}

/** Send saved drafts. Returns how many were sent. */
export async function flushQueue(): Promise<number> {
  const all = await read();
  if (!all.length) return 0;
  const left: Draft[] = [];
  let sent = 0;
  for (const d of all) {
    try {
      await api.submitActivity(await buildForm(d));
      sent++;
    } catch (e) {
      // keep it for later only if the server was unreachable; drop drafts the server rejected
      if (!(e instanceof ApiError) || e.offline || e.status >= 500) left.push(d);
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(left));
  return sent;
}
