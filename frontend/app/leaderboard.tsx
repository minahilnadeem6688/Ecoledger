/**
 * Leaderboard, ranked by CCT minted (the on-chain record, not spendable points).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, font, R, S } from '@/constants/theme';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { Card, Empty, Loading, Notice, PageTitle, Screen, useLayout } from '@/components/ui';

const MEDAL = ['#D9A521', '#9AA5A0', '#B7794B'];

export default function Leaderboard() {
  const { user } = useSession();
  const { isTablet } = useLayout();
  const { data, loading, error } = useLoad(() => api.leaderboard());
  const list = data || [];
  const top = list.slice(0, 3);
  // podium order: 2nd, 1st, 3rd
  const podium = top.length === 3 ? [top[1], top[0], top[2]] : top;
  const rankOf = (id: string) => list.findIndex((p) => p._id === id) + 1;

  return (
    <Screen role="any" maxWidth={820}>
      <PageTitle title="Leaderboard" subtitle="Ranked by Campus Carbon Tokens minted for verified actions." />
      {error ? <Notice tone="red" icon="alert-circle">{error}</Notice> : null}
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="trophy-outline" title="No rankings yet" body="Rankings appear once the first activities are approved." />
      ) : (
        <>
          {isTablet && top.length === 3 ? (
            <View style={s.podium}>
              {podium.map((p) => {
                const rank = rankOf(p._id);
                return (
                  <View key={p._id} style={[s.step, rank === 1 && s.stepFirst]}>
                    <View style={[s.avatar, { borderColor: MEDAL[rank - 1] }]}>
                      <Text style={s.avatarText}>{p.name[0]?.toUpperCase()}</Text>
                    </View>
                    <Ionicons name="trophy" size={rank === 1 ? 24 : 20} color={MEDAL[rank - 1]} />
                    <Text style={s.podName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.podValue}>{p.cctTokens} CCT</Text>
                    <View style={[s.block, { height: rank === 1 ? 70 : rank === 2 ? 50 : 36 }]}>
                      <Text style={s.blockText}>{rank}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <Card style={{ paddingVertical: S.sm }}>
            {list.map((p, i) => {
              const me = p._id === user?._id;
              return (
                <View key={p._id} style={[s.row, me && s.rowMe, i === list.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[s.rank, i < 3 && { backgroundColor: MEDAL[i] }]}>
                    <Text style={[s.rankText, i < 3 && { color: '#fff' }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.name} numberOfLines={1}>{p.name}{me ? '  (you)' : ''}</Text>
                    <Text style={s.sub}>{p.ecoPoints} eco points to spend</Text>
                  </View>
                  <Text style={s.value}>{p.cctTokens}<Text style={s.unit}> CCT</Text></Text>
                </View>
              );
            })}
          </Card>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: S.lg, paddingTop: S.md },
  step: { flex: 1, maxWidth: 200, alignItems: 'center', gap: 6 },
  stepFirst: { marginBottom: 0 },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, backgroundColor: C.blush, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font, fontSize: 24, fontWeight: '800', color: C.roseDeep },
  podName: { fontFamily: font, fontSize: 15, fontWeight: '700', color: C.ink, maxWidth: '100%' },
  podValue: { fontFamily: font, fontSize: 13.5, fontWeight: '700', color: C.green },
  block: { alignSelf: 'stretch', backgroundColor: C.green, borderTopLeftRadius: R.md, borderTopRightRadius: R.md, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  blockText: { fontFamily: font, fontSize: 20, fontWeight: '800', color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, paddingHorizontal: S.sm, borderBottomWidth: 1, borderBottomColor: C.line },
  rowMe: { backgroundColor: C.roseTint, borderRadius: R.md },
  rank: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1EEEF', alignItems: 'center', justifyContent: 'center' },
  rankText: { fontFamily: font, fontSize: 14, fontWeight: '800', color: C.muted },
  name: { fontFamily: font, fontSize: 16, fontWeight: '700', color: C.ink },
  sub: { fontFamily: font, fontSize: 13, color: C.muted, marginTop: 2 },
  value: { fontFamily: font, fontSize: 20, fontWeight: '800', color: C.green },
  unit: { fontSize: 13, color: C.muted },
});
