/**
 * Load data when a screen gains focus, with loading and error state.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    try {
      setError('');
      setData(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load data.');
    } finally {
      setLoading(false);
    }
  }, deps);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { data, setData, error, loading, reload };
}
