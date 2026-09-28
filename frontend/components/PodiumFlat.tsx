/**
 * Podium for the top three as flat shapes: used on native and as the web fallback.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, font, R } from '@/constants/theme';

export const PODIUM_COLORS = ['#D4A537', '#A9B2B8', '#B9794A']; // gold, silver, bronze

export default function PodiumFlat({ width, count = 3 }: { width: number; count?: number }) {
  const order = [2, 1, 3].filter((r) => r <= count);
  const h = width * 0.5;
  return (
    <View style={[s.row, { width, height: h }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {order.map((rank) => (
        <View key={rank} style={s.col}>
          <Ionicons name="trophy" size={rank === 1 ? 44 : 36} color={PODIUM_COLORS[rank - 1]} />
          <View style={[s.block, { height: h * (rank === 1 ? 0.42 : rank === 2 ? 0.3 : 0.22) }]}>
            <Text style={s.num}>{rank}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, alignSelf: 'center' },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  block: { alignSelf: 'stretch', backgroundColor: C.green, borderTopLeftRadius: R.md, borderTopRightRadius: R.md, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: font, fontSize: 20, fontWeight: '800', color: C.blush },
});
