/**
 * EcoLedger — Leaderboard
 * Location: ecoledger-app/app/leaderboard.tsx
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getLeaderboard, LeaderEntry } from '../store';

const C = { bg: '#FFDBE5', rose: '#E27396', amaranth: '#EA9AB2', green: '#6D9F71', dark: '#337357', white: '#FFFFFF', txt: '#2D2D2D', grey: '#7A7A7A', lightGreen: '#EAF4EC', gold: '#F59E0B', silver: '#9E9E9E', bronze: '#CD7F32' };

export default function Leaderboard() {
  const [board, setBoard] = useState<LeaderEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => { setBoard(await getLeaderboard()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const top3 = board.slice(0, 3);
  const rest = board.slice(3);
  const medals = ['🥇', '🥈', '🥉'];
  const podiumBg = [C.dark, '#4A7C5C', '#F0EDE8'];
  const podiumTxt = [C.white, C.white, C.txt];
  const podiumHeights = [130, 100, 85];
  // visual order: 2nd | 1st | 3rd
  const podiumOrder = [1, 0, 2].map(i => ({ entry: top3[i], realRank: i })).filter(x => x.entry);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.dark} />}>

        {/* Title */}
        <View style={s.titleBar}>
          <Text style={s.pageTitle}>Leaderboard</Text>
          <Text style={s.pageSub}>Top Eco Contributors 🌱</Text>
          <Text style={s.based}>Based on verified activities</Text>
        </View>

        {/* Podium */}
        {top3.length > 0 && (
          <View style={s.podiumWrap}>
            {podiumOrder.map(({ entry, realRank }, idx) => (
              <View key={entry.name} style={[s.podiumItem, { justifyContent: 'flex-end', height: podiumHeights[realRank] + 70 }]}>
                <Text style={s.podiumMedal}>{medals[realRank]}</Text>
                <View style={[s.podiumBlock, {
                  height: podiumHeights[realRank],
                  backgroundColor: podiumBg[realRank],
                  borderWidth: entry.isCurrentUser ? 2 : 0,
                  borderColor: C.rose,
                }]}>
                  <Text style={[s.podiumName, { color: podiumTxt[realRank] }]}>{entry.name.split(' ')[0]}</Text>
                  <Text style={[s.podiumPts, { color: podiumTxt[realRank], opacity: 0.85 }]}>{entry.pts} pts</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Rest of list */}
        <View style={s.listCard}>
          {rest.map((entry, i) => (
            <View key={entry.name} style={[s.listRow, entry.isCurrentUser && s.listRowMe, i > 0 && { borderTopWidth: 1, borderTopColor: '#F0F0F0' }]}>
              <Text style={[s.rank, entry.isCurrentUser && { color: C.dark, fontWeight: '800' }]}>#{i + 4}</Text>
              <View style={s.nameWrap}>
                <Text style={[s.listName, entry.isCurrentUser && { color: C.dark, fontWeight: '800' }]}>{entry.name}</Text>
                {entry.isCurrentUser && <View style={s.youBadge}><Text style={s.youTxt}>You</Text></View>}
              </View>
              <Text style={[s.listPts, entry.isCurrentUser && { color: C.dark, fontWeight: '800' }]}>{entry.pts} pts</Text>
            </View>
          ))}
          <View style={s.poweredBy}><Text style={s.poweredTxt}>Powered by EcoLedger</Text></View>
        </View>

        <Footer />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  titleBar: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, alignItems: 'center' },
  pageTitle: { fontSize: 30, fontWeight: '800', color: C.dark, textAlign: 'center' },
  pageSub: { fontSize: 16, color: C.green, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  based: { fontSize: 13, color: C.grey, marginTop: 4, textAlign: 'center' },
  podiumWrap: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginHorizontal: 20, marginBottom: 24, gap: 10 },
  podiumItem: { alignItems: 'center', flex: 1 },
  podiumMedal: { fontSize: 28, marginBottom: 6 },
  podiumBlock: { width: '100%', borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  podiumName: { fontSize: 15, fontWeight: '700' },
  podiumPts: { fontSize: 13, marginTop: 2 },
  listCard: { marginHorizontal: 20, backgroundColor: C.white, borderRadius: 20, overflow: 'hidden', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  listRowMe: { backgroundColor: C.lightGreen },
  rank: { fontSize: 14, color: C.grey, width: 40, fontWeight: '600' },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  listName: { fontSize: 15, color: C.txt, fontWeight: '500' },
  youBadge: { backgroundColor: C.rose, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  youTxt: { color: C.white, fontSize: 10, fontWeight: '800' },
  listPts: { fontSize: 15, color: C.rose, fontWeight: '600' },
  poweredBy: { alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  poweredTxt: { fontSize: 12, color: C.grey },
});