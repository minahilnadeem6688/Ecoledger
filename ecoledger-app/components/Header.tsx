/**
 * EcoLedger — Header (Top Navigation Bar)
 * Location: ecoledger-app/components/Header.tsx
 *
 * Dark header with logo on left, all nav links on right.
 * Active page is highlighted. Works on all screens.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, Modal, ScrollView, Animated,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  headerBg: '#1A1A1A',
  headerBorder: '#2D2D2D',
  logo: '#A78BFA',        // purple like "Bloom & You"
  navLink: '#CCCCCC',
  navActive: '#FFFFFF',
  navActiveBg: '#2D2D2D',
  green: '#6D9F71',
  dark: '#337357',
  white: '#FFFFFF',
  rose: '#E27396',
};

const NAV_LINKS = [
  { label: 'HOME',        route: '/(tabs)' },
  { label: 'ACTIVITIES',  route: '/activities' },
  { label: 'SUBMIT',      route: '/submit-activity' },
  { label: 'LEADERBOARD', route: '/leaderboard' },
  { label: 'WALLET',      route: '/wallet' },
  { label: 'REWARDS',     route: '/rewards' },
  { label: 'ADMIN',       route: '/admin' },
];

export default function Header() {
  const router = useRouter();
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (route: string) =>
    path === route || (route === '/(tabs)' && (path === '/' || path === '/index'));

  const handleLogout = async () => {
    await AsyncStorage.removeItem('ecoUser');
    setMenuOpen(false);
    router.replace('/login');
  };

  const handleNav = (route: string) => {
    setMenuOpen(false);
    router.push(route as any);
  };

  return (
    <>
      <View style={styles.header}>
        {/* Logo */}
        <TouchableOpacity onPress={() => router.push('/(tabs)' as any)} activeOpacity={0.8}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoIcon}>🌿</Text>
            <Text style={styles.logo}>EcoLedger</Text>
          </View>
        </TouchableOpacity>

        {/* Desktop nav links (shows on wider screens) */}
        <View style={styles.navLinks}>
          {NAV_LINKS.map(n => (
            <TouchableOpacity
              key={n.label}
              style={[styles.navBtn, isActive(n.route) && styles.navBtnActive]}
              onPress={() => handleNav(n.route)}
              activeOpacity={0.75}
            >
              <Text style={[styles.navTxt, isActive(n.route) && styles.navTxtActive]}>
                {n.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutTxt}>LOGOUT</Text>
          </TouchableOpacity>
        </View>

        {/* Mobile hamburger */}
        <TouchableOpacity style={styles.hamburger} onPress={() => setMenuOpen(true)} activeOpacity={0.8}>
          <View style={styles.hamLine} />
          <View style={[styles.hamLine, { width: 18 }]} />
          <View style={styles.hamLine} />
        </TouchableOpacity>
      </View>

      {/* Mobile Drawer */}
      <Modal visible={menuOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.logo}>🌿 EcoLedger</Text>
              <TouchableOpacity onPress={() => setMenuOpen(false)}>
                <Text style={{ color: C.navLink, fontSize: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {NAV_LINKS.map(n => (
                <TouchableOpacity
                  key={n.label}
                  style={[styles.drawerItem, isActive(n.route) && styles.drawerItemActive]}
                  onPress={() => handleNav(n.route)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.drawerItemTxt, isActive(n.route) && { color: C.white }]}>
                    {n.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.drawerLogout} onPress={handleLogout} activeOpacity={0.8}>
                <Text style={styles.drawerLogoutTxt}>LOGOUT</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: C.headerBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 52 : 14,
    paddingBottom: 14,
    zIndex: 100,
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoIcon: { fontSize: 18 },
  logo: { fontSize: 18, fontWeight: '800', color: C.logo, letterSpacing: 0.3 },

  // Desktop nav
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // hide on very small screens — hamburger takes over
    display: 'flex',
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  navBtnActive: {
    backgroundColor: C.navActiveBg,
  },
  navTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: C.navLink,
    letterSpacing: 0.8,
  },
  navTxtActive: {
    color: C.navActive,
  },
  logoutBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.rose,
  },
  logoutTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: C.rose,
    letterSpacing: 0.8,
  },

  // Hamburger (mobile)
  hamburger: {
    display: 'none', // shown on small screens via conditional rendering
    gap: 4,
    padding: 4,
  },
  hamLine: { width: 22, height: 2, backgroundColor: C.navLink, borderRadius: 1 },

  // Mobile drawer
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  drawer: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 260, backgroundColor: C.headerBg,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
  },
  drawerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: C.headerBorder, marginBottom: 8,
  },
  drawerItem: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  drawerItemActive: { backgroundColor: '#2A2A2A' },
  drawerItemTxt: { fontSize: 13, fontWeight: '600', color: C.navLink, letterSpacing: 1 },
  drawerLogout: { margin: 20, borderRadius: 10, borderWidth: 1, borderColor: C.rose, paddingVertical: 12, alignItems: 'center' },
  drawerLogoutTxt: { color: C.rose, fontWeight: '700', fontSize: 13, letterSpacing: 0.8 },
});