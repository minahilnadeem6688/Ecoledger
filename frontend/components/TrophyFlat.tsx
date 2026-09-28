/**
 * A medal-coloured trophy icon in a soft disc: used on native and as the web fallback.
 */
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const MEDAL = ['#D4A537', '#A9B2B8', '#B9794A'];      // gold, silver, bronze
export const MEDAL_TINT = ['#FBF3DC', '#EEF1F3', '#F7EBE1']; // soft backgrounds for each

export default function TrophyFlat({ size = 96, rank = 1 }: { size?: number; rank?: number; delay?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="trophy" size={size * 0.46} color={MEDAL[rank - 1]} />
    </View>
  );
}
