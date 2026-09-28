/**
 * Leaderboard, ranked by CCT minted (the on-chain record, not spendable points).
 * The top three get their own cards with a trophy; everyone is listed below with a bar
 * showing how close they are to the leader.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { C, font, R, S } from '@/constants/theme';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { Card, Empty, Loading, Notice, PageTitle, Screen, useLayout } from '@/components/ui';
import TrophyCup3D, { MEDAL, MEDAL_TINT } from '@/components/TrophyCup3D';

type Person = { _id: string; name: string; ecoPoints: number; cctTokens: number };
const PLACE = ['1st', '2nd', '3rd'];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

/** Counts a number up from zero once, easing out. */
function useCountUp(to: number, delay = 0, duration = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = Date.now() + delay;
    const tick = () => {
      const p = Math.min(1, Math.max(0, (Date.now() - t0) / duration));
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, duration]);
  return v;
}

/** Fades in and rises a little after `delay` ms. */
function Rise({ delay, children, style }: { delay: number; children: React.ReactNode; style?: any }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function TopCard({ p, rank, me, compact, lead }: { p: Person; rank: number; me: boolean; compact?: boolean; lead?: boolean }) {
  const delay = rank === 1 ? 120 : rank === 2 ? 0 : 240;
  const value = useCountUp(p.cctTokens, delay + 350);
  const trophy = lead ? 150 : compact ? 96 : 124;
  return (
    <Rise delay={delay} style={{ flex: 1, minWidth: 0 }}>
      <View style={[s.top, lead && s.topLead]}>
        <View style={[s.topArt, { backgroundColor: MEDAL_TINT[rank - 1] }]}>
          <TrophyCup3D size={trophy} rank={rank} delay={delay / 1000 + 0.15} />
        </View>
        <View style={[s.place, { backgroundColor: MEDAL[rank - 1] }]}>
          <Text style={s.placeText}>{PLACE[rank - 1]}</Text>
        </View>
        <View style={s.topBody}>
          <Text style={[s.topName, compact && { fontSize: 14.5 }]} numberOfLines={2}>{p.name}{me ? ' (you)' : ''}</Text>
          <Text style={[s.topValue, lead && { fontSize: 38 }, compact && { fontSize: 26 }]}>
            {value}<Text style={s.topUnit}> CCT</Text>
          </Text>
          <Text style={s.topSub}>{p.ecoPoints} eco points</Text>
        </View>
      </View>
    </Rise>
  );
}

function Row({ p, i, max, me, last }: { p: Person; i: number; max: number; me: boolean; last: boolean }) {
  const bar = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(bar, { toValue: max ? p.cctTokens / max : 0, duration: 900, delay: 450 + Math.min(i, 12) * 60, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [bar, p.cctTokens, max, i]);
  const medal = i < 3;
  return (
    <Rise delay={300 + Math.min(i, 12) * 60}>
      <View style={[s.row, me && s.rowMe, last && { borderBottomWidth: 0 }]}>
        <Text style={[s.rank, medal && { color: MEDAL[i] }]}>{i + 1}</Text>
        <View style={[s.avatar, { backgroundColor: medal ? MEDAL_TINT[i] : C.roseTint }]}>
          <Text style={[s.avatarText, { color: medal ? MEDAL[i] : C.roseDeep }]}>{initials(p.name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <View style={s.rowTop}>
            <Text style={s.name} numberOfLines={1}>{p.name}{me ? '  ·  you' : ''}</Text>
            <Text style={s.value}>{p.cctTokens}<Text style={s.unit}> CCT</Text></Text>
          </View>
          <View style={s.track}>
            <Animated.View style={[s.fill, { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }, medal && { backgroundColor: MEDAL[i] }]} />
          </View>
        </View>
      </View>
    </Rise>
  );
}

export default function Leaderboard() {
  const { user } = useSession();
  const { isTablet } = useLayout();
  const { data, loading, error } = useLoad(() => api.leaderboard());
  const list: Person[] = data || [];
  const top = list.slice(0, 3);
  const max = list[0]?.cctTokens || 0;
  const mine = (p: Person) => p._id === user?._id;

  return (
    <Screen role="any" maxWidth={880}>
      <PageTitle title="Leaderboard" subtitle="Ranked by Campus Carbon Tokens minted for verified eco-actions." />
      {error ? <Notice tone="red" icon="alert-circle">{error}</Notice> : null}
      {loading ? <Loading /> : list.length === 0 ? (
        <Empty icon="trophy-outline" title="No rankings yet" body="Rankings appear once the first activities are approved." />
      ) : (
        <>
          {isTablet ? (
            <View style={s.podium}>
              {[2, 1, 3].filter((r) => r <= top.length).map((r) => (
                <View key={r} style={{ flex: 1, marginTop: r === 1 ? 0 : 36 }}>
                  <TopCard p={top[r - 1]} rank={r} me={mine(top[r - 1])} lead={r === 1} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: S.md }}>
              <TopCard p={top[0]} rank={1} me={mine(top[0])} lead />
              {top.length > 1 ? (
                <View style={{ flexDirection: 'row', gap: S.md }}>
                  {top.slice(1).map((p, k) => <TopCard key={p._id} p={p} rank={k + 2} me={mine(p)} compact />)}
                </View>
              ) : null}
            </View>
          )}

          <Card style={{ paddingVertical: S.xs, paddingHorizontal: isTablet ? S.lg : S.md }} padded={false}>
            {list.map((p, i) => <Row key={p._id} p={p} i={i} max={max} me={mine(p)} last={i === list.length - 1} />)}
          </Card>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  podium: { flexDirection: 'row', gap: S.lg, alignItems: 'flex-start' },
  top: { backgroundColor: C.card, borderRadius: R.xl, borderWidth: 1, borderColor: 'rgba(230,191,204,0.55)', overflow: 'hidden', alignItems: 'center', boxShadow: '0 1px 2px rgba(27,43,36,0.04), 0 16px 36px -20px rgba(51,115,87,0.35)' } as any,
  topLead: { borderColor: 'rgba(212,165,55,0.45)' },
  topArt: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingTop: S.md, paddingBottom: S.lg },
  place: { marginTop: -14, paddingHorizontal: 12, paddingVertical: 5, borderRadius: R.pill, borderWidth: 3, borderColor: C.card },
  placeText: { fontFamily: font, fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.4 },
  topBody: { alignItems: 'center', paddingHorizontal: S.md, paddingTop: S.sm, paddingBottom: S.lg, gap: 2, alignSelf: 'stretch' },
  topName: { fontFamily: font, fontSize: 16, fontWeight: '600', color: C.ink, textAlign: 'center', letterSpacing: -0.2 },
  topValue: { fontFamily: font, fontSize: 32, fontWeight: '700', color: C.green, letterSpacing: -1.2, fontVariant: ['tabular-nums'], marginTop: 2 },
  topUnit: { fontSize: 13, fontWeight: '600', color: C.muted, letterSpacing: 0.4 },
  topSub: { fontFamily: font, fontSize: 12.5, color: C.muted },

  row: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 14, paddingHorizontal: S.sm, borderBottomWidth: 1, borderBottomColor: C.line },
  rowMe: { backgroundColor: C.roseTint, borderRadius: R.md, borderBottomColor: 'transparent' },
  rank: { width: 22, textAlign: 'center', fontFamily: font, fontSize: 14, fontWeight: '600', color: C.muted, fontVariant: ['tabular-nums'] },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font, fontSize: 13.5, fontWeight: '700', letterSpacing: 0.3 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: S.sm },
  name: { fontFamily: font, fontSize: 15.5, fontWeight: '600', color: C.ink, flexShrink: 1, letterSpacing: -0.2 },
  value: { fontFamily: font, fontSize: 17, fontWeight: '700', color: C.ink, letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 12, fontWeight: '600', color: C.muted },
  track: { height: 6, borderRadius: 3, backgroundColor: '#F4E8ED', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: C.sage },
});
