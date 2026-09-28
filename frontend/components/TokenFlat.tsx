/**
 * The Campus Carbon Token as a flat drawing: used on native and as the web fallback.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '@/constants/theme';

export default function TokenFlat({ size = 220 }: { size?: number }) {
  const coin = size * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[s.ring, { width: size * 0.96, height: size * 0.42, borderRadius: size }]} />
      <View style={[s.coin, { width: coin, height: coin, borderRadius: coin / 2, borderWidth: Math.max(4, coin * 0.06) }]}>
        <Ionicons name="leaf" size={coin * 0.34} color={C.blush} />
        <Text style={[s.cct, { fontSize: coin * 0.13 }]}>CCT</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(226,115,150,0.35)', transform: [{ rotate: '-12deg' }] },
  coin: { backgroundColor: C.green, borderColor: '#E8A3B8', alignItems: 'center', justifyContent: 'center', gap: 2 },
  cct: { color: C.blush, fontWeight: '800', letterSpacing: 2 },
});
