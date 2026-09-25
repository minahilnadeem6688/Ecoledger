/**
 * EcoLedger — Footer
 * Location: ecoledger-app/components/Footer.tsx
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

const C = {
  darkBar: '#1A1A1A',
  white: '#FFFFFF',
  darkTxt: '#2D2D2D',
  green: '#337357',
};

// ── Navigate column removed; only EcoLedger info links remain ──
const INFO_COL = {
  title: 'EcoLedger',
  links: [
    { label: 'About Us',       route: null },
    { label: 'How It Works',   route: null },
    { label: 'Blockchain FAQ', route: null },
    { label: 'Admin Panel',    route: '/admin' },
  ],
};

export default function Footer() {
  const router = useRouter();

  const handleNav = (route: string | null) => {
    if (route) router.push(route as any);
  };

  return (
    <View>
      {/* ── Nav columns section ── */}
      <View style={styles.navSection}>
        {/* Brand col */}
        <View style={styles.brandCol}>
          <Text style={styles.brandLogo}>🌿 EcoLedger</Text>
          <Text style={styles.brandTagline}>Track. Earn. Sustain.</Text>
          <Text style={styles.brandDesc}>
            A blockchain-based platform rewarding students for verified eco-friendly actions on campus.
          </Text>
        </View>

        {/* Single info col — Navigate removed */}
        <View style={styles.navCol}>
          <Text style={styles.colTitle}>{INFO_COL.title}</Text>
          {INFO_COL.links.map(l => (
            <TouchableOpacity key={l.label} onPress={() => handleNav(l.route)} activeOpacity={0.7}>
              <Text style={styles.colLink}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Dark bottom bar ── */}
      <View style={styles.darkBar}>
        <Text style={styles.copy}>© 2026 EcoLedger | Privacy Policy | Terms of Service</Text>
        <Text style={styles.tagline}>Handcrafted in Pakistan. Engineered for Your Planet.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navSection: {
    // Warm dusty rose — darker than the page's blush pink so it's distinct
    // but still in the same family rather than jarring white
    backgroundColor: '#EDCDD6',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 28,
    paddingVertical: 36,
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: '#D9B0BC',
  },
  brandCol: { flex: 2, minWidth: 180 },
  brandLogo: { fontSize: 18, fontWeight: '800', color: C.green, marginBottom: 6 },
  brandTagline: { fontSize: 13, color: '#7A5C63', marginBottom: 10, fontStyle: 'italic' },
  brandDesc: { fontSize: 12, color: '#6B4C54', lineHeight: 18 },
  navCol: { flex: 1, minWidth: 120 },
  colTitle: { fontSize: 13, fontWeight: '800', color: C.darkTxt, marginBottom: 12, letterSpacing: 0.5 },
  colLink: { fontSize: 13, color: '#6B4C54', marginBottom: 9, lineHeight: 18 },
  darkBar: {
    backgroundColor: C.darkBar,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
  },
  copy: { fontSize: 11, color: '#999', textAlign: 'center' },
  tagline: { fontSize: 11, color: '#666', textAlign: 'center', fontStyle: 'italic' },
});