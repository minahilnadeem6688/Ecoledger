/**
 * EcoLedger — Rewards  (FIXED)
 * Location: ecoledger-app/app/rewards.tsx
 *
 * BUG D FIX: load() previously called getUser() which read stale AsyncStorage.
 * If the admin approved the student's activity the points were updated in MongoDB
 * but the student's local cache still showed 0.
 * Fix: call syncUserFromBackend() which fetches GET /students/:id and updates
 * the local cache before the UI renders.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, Animated, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  syncUserFromBackend,   // ← FIXED: was getUser()
  EcoUser,
  getRewards,
  redeemRewardStore,
  isBackendRunning,
} from '../store';

const C = {
  bg: '#FFDBE5', rose: '#E27396', amaranth: '#EA9AB2',
  green: '#6D9F71', dark: '#337357', white: '#FFFFFF',
  txt: '#2D2D2D', grey: '#7A7A7A', lightGreen: '#EAF4EC',
};

interface Reward { id: string; icon: string; title: string; desc: string; pts: number; }

export default function RewardsScreen() {
  const [user, setUser]               = useState<EcoUser | null>(null);
  const [rewards, setRewards]         = useState<Reward[]>([]);
  const [toast, setToast]             = useState('');
  const [refreshing, setRefreshing]   = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    // BUG D FIX: syncUserFromBackend fetches fresh ecoPoints from MongoDB
    // so the balance shown here always reflects the latest admin approvals.
    const [u, rwds, backendUp] = await Promise.all([
      syncUserFromBackend(),   // ← was getUser()
      getRewards(),
      isBackendRunning(),
    ]);
    setUser(u);
    setRewards(rwds);
    setBackendOnline(backendUp);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const showToast = (msg: string) => {
    setToast(msg);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.delay(2800),
      Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 8 }),
    ]).start();
  };

  const handleRedeem = (reward: Reward) => {
    if (!user) return;
    const pts = user.ecoPoints ?? 0;

    if (pts < reward.pts) {
      Alert.alert(
        'Not Enough Points ❌',
        `You need ${reward.pts} pts but have ${pts}.\n\nEarn ${reward.pts - pts} more by getting activities approved!`,
      );
      return;
    }

    Alert.alert(
      `Redeem ${reward.title}? ${reward.icon}`,
      `Cost: ${reward.pts} EcoPoints\n` +
      `Your balance: ${pts} pts\n` +
      `After redeeming: ${pts - reward.pts} pts\n\n` +
      (backendOnline ? '✅ Synced with MongoDB' : '⚠️ Backend offline — saved locally'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem Now',
          onPress: async () => {
            const result = await redeemRewardStore(reward.id, reward.pts);
            if (result.success) {
              // Re-sync from backend so the new balance is accurate
              const updatedUser = await syncUserFromBackend();
              setUser(updatedUser);
              showToast(`${reward.icon} ${reward.title} redeemed! -${reward.pts} pts`);
            } else {
              Alert.alert('Failed ❌', result.message);
            }
          },
        },
      ],
    );
  };

  const pts = user?.ecoPoints ?? 0;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      <Header />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            tintColor={C.dark}
          />
        }
      >
        <View style={s.titleBar}>
          <Text style={s.pageTitle}>Rewards</Text>
          <Text style={s.pageSub}>Redeem your EcoPoints 🎁</Text>
        </View>

        <View style={s.content}>
          {/* Backend status */}
          <View style={[s.statusBanner, { backgroundColor: backendOnline ? '#E8F5E9' : '#FFF8E1' }]}>
            <View style={[s.statusDot, { backgroundColor: backendOnline ? C.green : '#F59E0B' }]} />
            <Text style={[s.statusTxt, { color: backendOnline ? C.dark : '#92400E' }]}>
              {backendOnline
                ? 'Rewards synced with MongoDB ✓'
                : 'Backend offline — showing local rewards'}
            </Text>
          </View>

          {/* Balance card */}
          <View style={s.balanceCard}>
            <View style={s.balanceGlow} />
            <Text style={s.balanceLabel}>Your Points Balance</Text>
            <View style={s.balanceRow}>
              <Text style={s.balancePts}>{pts} EcoPoints</Text>
              <Text style={{ fontSize: 22 }}>🏅</Text>
            </View>
            <Text style={s.balanceCct}>CCT Tokens: {user?.cctTokens ?? 0} CCT 🌿</Text>
          </View>

          {/* Rewards grid */}
          <Text style={s.sectionTitle}>Available Rewards:</Text>
          {rewards.length === 0 ? (
            <View style={s.emptyRewards}>
              <Text style={s.emptyIcon}>🎁</Text>
              <Text style={s.emptyTxt}>No rewards available yet.</Text>
              <Text style={s.emptySubTxt}>Check back later or ask your admin to add rewards.</Text>
            </View>
          ) : (
            <View style={s.rewardsGrid}>
              {rewards.map(r => {
                const canRedeem = pts >= r.pts;
                return (
                  <View key={r.id} style={[s.rewardCard, !canRedeem && s.rewardCardDim]}>
                    <Text style={s.rewardIcon}>{r.icon}</Text>
                    <Text style={s.rewardTitle}>{r.title}</Text>
                    <Text style={s.rewardDesc}>{r.desc}</Text>
                    <Text style={s.rewardPts}>{r.pts} Points</Text>
                    {!canRedeem && (
                      <Text style={s.needMore}>Need {r.pts - pts} more pts</Text>
                    )}
                    <TouchableOpacity
                      style={[s.redeemBtn, !canRedeem && s.redeemBtnDis]}
                      onPress={() => handleRedeem(r)}
                      activeOpacity={canRedeem ? 0.85 : 0.6}
                    >
                      <Text style={[s.redeemTxt, !canRedeem && { color: C.grey }]}>
                        {canRedeem ? 'Redeem' : 'Not enough points'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <Text style={s.note}>Rewards are based on verified sustainable actions</Text>
        </View>

        <Footer />
      </ScrollView>

      {/* Toast */}
      <Animated.View style={[s.toast, {
        opacity: toastAnim,
        transform: [{
          translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
        }],
      }]}>
        <Text style={s.toastTxt}>{toast}</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  titleBar: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: C.dark },
  pageSub: { fontSize: 14, color: C.green, fontWeight: '500', marginTop: 3 },
  content: { padding: 20 },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusTxt: { fontSize: 12, fontWeight: '500', flex: 1 },
  balanceCard: {
    borderRadius: 20, backgroundColor: C.white, padding: 20,
    marginBottom: 24, overflow: 'hidden',
    shadowColor: C.green, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
  },
  balanceGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.lightGreen, opacity: 0.5,
  },
  balanceLabel: { fontSize: 13, color: C.grey, textAlign: 'center', marginBottom: 6 },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, marginBottom: 6,
  },
  balancePts: { fontSize: 28, fontWeight: '800', color: C.rose },
  balanceCct: { fontSize: 13, color: C.grey, textAlign: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.txt, marginBottom: 14 },
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  rewardCard: {
    width: '47.5%', backgroundColor: C.white, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  rewardCardDim: { opacity: 0.8 },
  rewardIcon: { fontSize: 26, marginBottom: 8 },
  rewardTitle: { fontSize: 14, fontWeight: '700', color: C.txt, marginBottom: 4 },
  rewardDesc: { fontSize: 12, color: C.grey, lineHeight: 16, marginBottom: 8 },
  rewardPts: { fontSize: 16, fontWeight: '700', color: C.rose, marginBottom: 4 },
  needMore: { fontSize: 11, color: '#F59E0B', marginBottom: 8, fontWeight: '500' },
  redeemBtn: {
    backgroundColor: C.dark, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  redeemBtnDis: { backgroundColor: '#E0E0E0' },
  redeemTxt: { color: C.white, fontSize: 13, fontWeight: '700' },
  emptyRewards: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTxt: { fontSize: 16, fontWeight: '700', color: C.dark },
  emptySubTxt: { fontSize: 13, color: C.grey, textAlign: 'center', marginTop: 6 },
  note: {
    fontSize: 13, color: C.green, textAlign: 'center',
    fontWeight: '500', marginBottom: 8, marginTop: 4,
  },
  toast: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: C.dark, borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: C.dark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  toastTxt: { color: C.white, fontSize: 14, fontWeight: '700' },
});