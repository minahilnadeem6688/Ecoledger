/**
 * Leaderboard, ranked by CCT minted (the on-chain record, not spendable points).
 * The top three stand on a podium; everyone is listed below.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { C, font, R, S } from '@/constants/theme';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { Card, Empty, Loading, Notice, PageTitle, Screen } from '@/components/ui';
import Trophies3D, { PODIUM_COLORS } from '@/components/Trophies3D';

type Person = { _id: string; name: string; ecoPoints: number; cctTokens: number };

/** Fades a row in and lifts it a little, one after another. */
function RowIn({ index, children }: { index: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay: 250 + Math.min(index, 12) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, index]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

export default function Leaderboard() {
  const { user } = useSession();
  const { width } = useWindowDimensions();
  const { data, loading, error } = useLoad(() => api.leaderboard());
  const list: Person[] = data || [];
  const top = list.slice(0, 3);
  const podiumW = Math.min(640, width - 2 * S.lg);
  // columns left to right: 2nd, 1st, 3rd
  const columns = [2, 1, 3].filter((r) => r <= top.length);

  return (
    <Screen role="any" maxWidth={820}>
      <PageTitle title="Leaderboard" subtitle="Ranked by Campus Carbon Tokens minted for verified actions." />
      {error ? <Notice tone="red" icon="alert-circle">{error}</Notice> : null}
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="trophy-outline" title="No rankings yet" body="Rankings appear once the first activities are approved." />
      ) : (
        <>
          <View style={s.podiumWrap}>
            <Trophies3D width={podiumW} count={top.length} />
            <View style={[s.labels, { width: podiumW }]}>
              {columns.map((rank) => {
                const p = top[rank - 1];
                const me = p._id === user?._id;
                return (
                  <View key={p._id} style={s.label}>
                    <Text style={[s.place, { color: PODIUM_COLORS[rank - 1] }]}>{rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'}</Text>
                    <Text style={[s.podName, rank === 1 && s.podNameFirst, podiumW < 480 && s.podNameSmall]} numberOfLines={2}>{p.name}{me ? ' (you)' : ''}</Text>
                    <Text style={s.podValue}>{p.cctTokens} CCT</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <Card style={{ paddingVertical: S.sm }}>
            {list.map((p, i) => {
              const me = p._id === user?._id;
              return (
                <RowIn key={p._id} index={i}>
                  <View style={[s.row, me && s.rowMe, i === list.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[s.rank, i < 3 && { backgroundColor: PODIUM_COLORS[i] }]}>
                      <Text style={[s.rankText, i < 3 && { color: '#fff' }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.name} numberOfLines={1}>{p.name}{me ? '  (you)' : ''}</Text>
                      <Text style={s.sub}>{p.ecoPoints} eco points to spend</Text>
                    </View>
                    <Text style={s.value}>{p.cctTokens}<Text style={s.unit}> CCT</Text></Text>
                  </View>
                </RowIn>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  podiumWrap: { alignItems: 'center', marginTop: -S.sm },
  labels: { flexDirection: 'row', marginTop: S.sm },
  label: { flex: 1, alignItems: 'center', paddingHorizontal: 4, gap: 1 },
  place: { fontFamily: font, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  podName: { fontFamily: font, fontSize: 15, fontWeight: '700', color: C.ink, maxWidth: '100%', textAlign: 'center' },
  podNameFirst: { fontSize: 16.5 },
  podNameSmall: { fontSize: 14, lineHeight: 18 },
  podValue: { fontFamily: font, fontSize: 13.5, fontWeight: '700', color: C.green },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, paddingHorizontal: S.sm, borderBottomWidth: 1, borderBottomColor: C.line },
  rowMe: { backgroundColor: C.roseTint, borderRadius: R.md },
  rank: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1EEEF', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: font, fontSize: 14, fontWeight: '800', color: C.muted },
  name: { fontFamily: font, fontSize: 16, fontWeight: '700', color: C.ink },
  sub: { fontFamily: font, fontSize: 13, color: C.muted, marginTop: 2 },
  value: { fontFamily: font, fontSize: 20, fontWeight: '800', color: C.green },
  unit: { fontSize: 13, color: C.muted },
});
