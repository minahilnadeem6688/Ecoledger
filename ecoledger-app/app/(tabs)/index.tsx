/**
 * EcoLedger — Dashboard (Home)
 * Location: ecoledger-app/app/(tabs)/index.tsx
 */
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, StatusBar, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { getUser, getActivities, EcoUser, Activity, ACTIVITY_ICONS, timeAgo } from '../../store';

const C = { bg: '#FFDBE5', rose: '#E27396', green: '#6D9F71', dark: '#337357', white: '#FFFFFF', txt: '#2D2D2D', grey: '#7A7A7A', lightGreen: '#EAF4EC', cardGreen: '#D6EDD9', amaranth: '#EA9AB2', pending: '#F59E0B', rejected: '#EF4444' };

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<EcoUser | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const fadeCard = useRef(new Animated.Value(0)).current;
  const scaleCard = useRef(new Animated.Value(0.96)).current;
  const fadeRest = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const [u, acts] = await Promise.all([getUser(), getActivities()]);
    if (!u) { router.replace('/login'); return; }
    setUser(u); setActivities(acts);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    Animated.stagger(80, [
      Animated.parallel([
        Animated.spring(fadeCard, { toValue: 1, useNativeDriver: true, tension: 55, friction: 9 }),
        Animated.spring(scaleCard, { toValue: 1, useNativeDriver: true, tension: 55, friction: 9 }),
      ]),
      Animated.spring(fadeRest, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
    ]).start();
  }, [load]));

  const fu = (a: Animated.Value) => ({ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] });
  const statusColor = (s: Activity['status']) => s === 'Approved' ? C.green : s === 'Pending' ? C.pending : C.rejected;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      <Header />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={C.dark} />}>

        <View style={s.blob} />

        {/* Welcome */}
        <View style={s.welcome}>
          <View><Text style={s.greeting}>Hi, {user?.name || '...'} 👋</Text><Text style={s.greetSub}>Welcome back to EcoLedger</Text></View>
          <TouchableOpacity style={s.avatar}><Text style={s.avatarTxt}>{user?.name?.[0]?.toUpperCase() ?? '?'}</Text></TouchableOpacity>
        </View>

        {/* Impact Card */}
        <Animated.View style={{ opacity: fadeCard, transform: [{ scale: scaleCard }] }}>
          <View style={s.impactCard}>
            <View style={s.impactGlow} />
            <Text style={s.impactTitle}>Your Impact</Text>
            <View style={s.impactRow}>
              <View style={s.impactItem}><Text style={s.impactIcon}>🌿</Text><Text style={s.impactNum}>{user?.ecoPoints ?? 0}</Text><Text style={s.impactLabel}>Eco Points</Text></View>
              <View style={s.impactDiv} />
              <View style={s.impactItem}><Text style={s.impactIcon}>🪙</Text><Text style={[s.impactNum, { color: C.rose }]}>{user?.cctTokens ?? 0}</Text><Text style={s.impactLabel}>CCT Tokens</Text></View>
            </View>
            <View style={s.syncRow}><View style={s.syncDot} /><Text style={s.syncTxt}>Synced with blockchain</Text></View>
          </View>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View style={[s.actRow, fu(fadeRest)]}>
          {[
            { icon: '🌱', label: 'Submit\nActivity', bg: C.rose, color: C.white, route: '/submit-activity' },
            { icon: '👁️', label: 'View\nActivities', bg: C.white, color: C.txt, route: '/activities' },
            { icon: '🏆', label: 'Leader\nboard', bg: C.dark, color: C.white, route: '/leaderboard' },
          ].map(b => (
            <TouchableOpacity key={b.label} style={[s.actBtn, { backgroundColor: b.bg }]} onPress={() => router.push(b.route as any)} activeOpacity={0.85}>
              <Text style={s.actIcon}>{b.icon}</Text><Text style={[s.actTxt, { color: b.color }]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Recent Activities */}
        <Animated.View style={[{ marginHorizontal: 20, marginBottom: 28 }, fu(fadeRest)]}>
          <View style={s.secRow}>
            <Text style={s.secTitle}>Recent Activities</Text>
            <TouchableOpacity onPress={() => router.push('/activities' as any)}><Text style={s.seeAll}>See all →</Text></TouchableOpacity>
          </View>
          <View style={s.actList}>
            {activities.length === 0 ? (
              <View style={s.empty}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>🌍</Text>
                <Text style={s.emptyTitle}>No activities yet</Text>
                <Text style={s.emptyDesc}>Submit your first eco activity to start earning points!</Text>
                <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/submit-activity' as any)}><Text style={s.emptyBtnTxt}>Submit Activity</Text></TouchableOpacity>
              </View>
            ) : activities.slice(0, 5).map((a, i, arr) => (
              <View key={a.id}>
                <View style={s.aRow}>
                  <View style={s.aIcon}><Text style={{ fontSize: 18 }}>{ACTIVITY_ICONS[a.type] ?? '🍃'}</Text></View>
                  <View style={{ flex: 1 }}><Text style={s.aTitle}>{a.type}</Text><Text style={s.aSub} numberOfLines={1}>{a.location || a.description}</Text></View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.aStatus, { color: statusColor(a.status) }]}>{a.status}</Text>
                    {a.status === 'Approved' && <Text style={s.aPts}>+{a.pts} pts</Text>}
                    <Text style={s.aTime}>{timeAgo(a.submittedAt)}</Text>
                  </View>
                </View>
                {i < arr.length - 1 && <View style={s.div} />}
              </View>
            ))}
          </View>
        </Animated.View>

        <Footer />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  blob: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: C.amaranth, opacity: 0.12, top: 0, right: -80, zIndex: 0 },
  welcome: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20 },
  greeting: { fontSize: 26, fontWeight: '800', color: C.dark },
  greetSub: { fontSize: 13, color: C.grey, marginTop: 2 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.green },
  avatarTxt: { fontSize: 20, fontWeight: '800', color: C.white },
  impactCard: { marginHorizontal: 20, borderRadius: 20, backgroundColor: C.white, padding: 24, overflow: 'hidden', marginBottom: 20, shadowColor: C.green, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
  impactGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.lightGreen, opacity: 0.45 },
  impactTitle: { fontSize: 18, fontWeight: '700', color: C.dark, textAlign: 'center', marginBottom: 16 },
  impactRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 12 },
  impactItem: { alignItems: 'center', flex: 1 },
  impactIcon: { fontSize: 28, marginBottom: 4 },
  impactNum: { fontSize: 36, fontWeight: '800', color: C.dark },
  impactLabel: { fontSize: 13, color: C.grey, marginTop: 2 },
  impactDiv: { width: 1, height: 56, backgroundColor: C.cardGreen },
  syncRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, marginRight: 6 },
  syncTxt: { fontSize: 12, color: C.grey },
  actRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 24 },
  actBtn: { flex: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  actIcon: { fontSize: 22, marginBottom: 6 },
  actTxt: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  secTitle: { fontSize: 18, fontWeight: '700', color: C.dark },
  seeAll: { fontSize: 13, color: C.rose, fontWeight: '600' },
  actList: { backgroundColor: C.white, borderRadius: 18, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.dark, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: C.grey, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  emptyBtn: { backgroundColor: C.dark, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnTxt: { color: C.white, fontWeight: '700', fontSize: 14 },
  aRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  aIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.lightGreen, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  aTitle: { fontSize: 14, fontWeight: '700', color: C.txt },
  aSub: { fontSize: 12, color: C.grey, marginTop: 2 },
  aStatus: { fontSize: 13, fontWeight: '600' },
  aPts: { fontSize: 12, color: C.green, fontWeight: '600', marginTop: 2 },
  aTime: { fontSize: 11, color: C.grey, marginTop: 2 },
  div: { height: 1, backgroundColor: '#F0F0F0' },
});