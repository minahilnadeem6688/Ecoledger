import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/lib/session';
import { Platform } from 'react-native';
import { C } from '@/constants/theme';

// Geist for the interface, Geist Mono for addresses and hashes (web). Native apps use the system font.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('eco-fonts')) {
  const pre = document.createElement('link');
  pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com'; pre.crossOrigin = 'anonymous';
  const css = document.createElement('link');
  css.id = 'eco-fonts'; css.rel = 'stylesheet';
  css.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';
  document.head.append(pre, css);
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade' }} />
        <StatusBar style="dark" />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
