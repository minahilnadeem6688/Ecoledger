/**
 * EcoLedger — My Activities  (FIXED)
 * Location: ecoledger-app/app/activities.tsx
 *
 * Fixes:
 *  - Loads real data from store (getActivities) on every focus + pull-to-refresh
 *  - Shows rejection reason when activity is rejected
 *  - All four filter tabs (All / Pending / Approved / Rejected) reflect live data
 *  - Points badge is only shown for Approved activities
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { getActivities, Activity, ACTIVITY_ICONS, formatDate } from '../store';

const C = {
  bg: '#FFDBE5', rose: '#E27396', amaranth: '#EA9AB2',
  green: '#6D9F71', dark: '#337357', white: '#FFFFFF',
  txt: '#2D2D2D', grey: '#7A7A7A', lightGreen: '#EAF4EC',
  pending: '#F59E0B', rejected: '#EF4444',
};

type Filter = 'All' | 'Pending' | 'Approved' | 'Rejected';

export default function Activities() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [refreshing, setRefreshing] = useState(false);

  // ── Load real data whenever the screen is focused ─────────────────
  const load = useCallback(async () => {
    const data = await getActivities();
    // Sort newest first
    const sorted = [...data].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    setActivities(sorted);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = filter === 'All'
    ? activities
    : activities.filter(a => a.status === filter);

  const counts: Record<Filter, number> = {
    All: activities.length,
    Pending: activities.filter(a => a.status === 'Pending').length,
    Approved: activities.filter(a => a.status === 'Approved').length,
    Rejected: activities.filter(a => a.status === 'Rejected').length,
  };

  const statusColor = (s: Activity['status']) =>
    s === 'Approved' ? C.green : s === 'Pending' ? C.pending : C.rejected;

  const statusIcon = (s: Activity['status']) =>
    s === 'Approved' ? '✅' : s === 'Pending' ? '⏳' : '❌';

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
        {/* Page title */}
        <View style={s.titleBar}>
          <View>
            <Text style={s.pageTitle}>My Activities</Text>
            <Text style={s.pageSub}>{activities.length} total submissions</Text>
          </View>
          <TouchableOpacity
            style={s.submitBtn}
            onPress={() => router.push('/submit-activity' as any)}
          >
            <Text style={s.submitBtnTxt}>+ Submit New</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs with live counts */}
        <View style={s.filterRow}>
          {(['All', 'Pending', 'Approved', 'Rejected'] as Filter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterBtn, filter === f && s.filterActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[s.filterTxt, filter === f && s.filterTxtActive]}>{f}</Text>
              {counts[f] > 0 && (
                <View style={[
                  s.filterCount,
                  filter === f
                    ? { backgroundColor: C.dark }
                    : { backgroundColor: '#F0F0F0' },
                ]}>
                  <Text style={[
                    s.filterCountTxt,
                    filter === f ? { color: C.white } : { color: C.grey },
                  ]}>
                    {counts[f]}
                  </Text>
                </View>
              )}
              {filter === f && <View style={s.filterLine} />}
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.content}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>🌿</Text>
              <Text style={s.emptyTitle}>
                {filter === 'All' ? 'No activities yet' : `No ${filter} activities`}
              </Text>
              <Text style={s.emptyDesc}>
                {filter === 'All'
                  ? 'Start submitting eco activities to earn points!'
                  : `You have no ${filter.toLowerCase()} activities.`}
              </Text>
              {filter === 'All' && (
                <TouchableOpacity
                  style={s.emptyBtn}
                  onPress={() => router.push('/submit-activity' as any)}
                >
                  <Text style={s.emptyBtnTxt}>+ Submit Activity</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map(a => (
              <View key={a.id} style={s.card}>
                {/* Card top row */}
                <View style={s.cardTop}>
                  <View style={s.cardLeft}>
                    <View style={s.iconWrap}>
                      <Text style={{ fontSize: 22 }}>{ACTIVITY_ICONS[a.type] ?? '🍃'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>{a.type}</Text>
                      <Text style={s.cardLoc}>📍 {a.location}</Text>
                      {!!a.description && (
                        <Text style={s.cardDesc} numberOfLines={2}>{a.description}</Text>
                      )}
                    </View>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={[s.statusTxt, { color: statusColor(a.status) }]}>
                      {statusIcon(a.status)} {a.status}
                    </Text>
                    <Text style={s.dateTxt}>{formatDate(a.submittedAt)}</Text>
                  </View>
                </View>

                {/* Card bottom strip */}
                <View style={s.cardBottom}>
                  {a.status === 'Approved' && (
                    <>
                      <Text style={s.pts}>+{a.pts} Points</Text>
                      <Text style={s.minted}>Tokens minted ✓</Text>
                    </>
                  )}
                  {a.status === 'Pending' && (
                    <>
                      <Text style={s.ptsPending}>+{a.pts} pts on approval</Text>
                      <Text style={s.waitTxt}>⏳ Waiting for admin verification</Text>
                    </>
                  )}
                  {a.status === 'Rejected' && (
                    <>
                      <Text style={s.rejTxt}>❌ Activity was rejected</Text>
                      {!!a.rejectionReason && (
                        <Text style={s.rejReason}>Reason: {a.rejectionReason}</Text>
                      )}
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={s.poweredBy}>
          <Text style={s.poweredTxt}>Powered by EcoLedger</Text>
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  titleBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20,
  },
  pageTitle: { fontSize: 26, fontWeight: '800', color: C.dark },
  pageSub: { fontSize: 12, color: C.grey, marginTop: 2 },
  submitBtn: {
    backgroundColor: C.dark, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  submitBtnTxt: { color: C.white, fontSize: 13, fontWeight: '700' },

  // Filter tabs
  filterRow: {
    flexDirection: 'row', backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', paddingHorizontal: 8,
  },
  filterBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    position: 'relative', gap: 4,
  },
  filterActive: {},
  filterTxt: { fontSize: 12, fontWeight: '500', color: C.grey },
  filterTxtActive: { color: C.dark, fontWeight: '700' },
  filterCount: {
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20,
    alignItems: 'center',
  },
  filterCountTxt: { fontSize: 10, fontWeight: '700' },
  filterLine: {
    position: 'absolute', bottom: 0, left: '15%', right: '15%',
    height: 2, backgroundColor: C.dark, borderRadius: 1,
  },

  // Cards
  content: { padding: 16 },
  card: {
    backgroundColor: C.white, borderRadius: 18, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12,
  },
  cardLeft: {
    flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 10,
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.lightGreen,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.txt },
  cardLoc: { fontSize: 13, color: C.grey, marginTop: 3 },
  cardDesc: { fontSize: 12, color: C.grey, marginTop: 4, lineHeight: 16 },
  cardRight: { alignItems: 'flex-end' },
  statusTxt: { fontSize: 13, fontWeight: '700' },
  dateTxt: { fontSize: 12, color: C.grey, marginTop: 3 },

  cardBottom: {
    borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10,
  },
  pts: { fontSize: 18, fontWeight: '800', color: C.rose, marginBottom: 2 },
  ptsPending: { fontSize: 15, fontWeight: '700', color: C.grey, marginBottom: 2 },
  minted: { fontSize: 12, color: C.green, fontWeight: '600' },
  waitTxt: { fontSize: 12, color: C.pending },
  rejTxt: { fontSize: 12, color: C.rejected, fontWeight: '600' },
  rejReason: {
    fontSize: 11, color: C.rejected, marginTop: 3,
    fontStyle: 'italic', lineHeight: 16,
  },

  // Empty state
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 8 },
  emptyDesc: {
    fontSize: 14, color: C.grey, textAlign: 'center',
    lineHeight: 20, marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: C.dark, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnTxt: { color: C.white, fontWeight: '700', fontSize: 14 },

  poweredBy: { alignItems: 'center', paddingVertical: 16 },
  poweredTxt: { fontSize: 12, color: C.grey },
});