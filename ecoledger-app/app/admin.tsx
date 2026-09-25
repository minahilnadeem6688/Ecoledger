/**
 * EcoLedger — Admin Panel  (FIXED)
 * Location: ecoledger-app/app/admin.tsx
 *
 * Fixes:
 *  - updateActivityStatus now called with correct (id, status, reason?) signature
 *  - Approve & Mint: on success, student points are incremented, blockchain mint triggered
 *  - Reject: reason is passed to store so it appears on the student's activities page
 *  - Rejected cards show rejection reason
 *  - Loading spinner shown while minting
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, RefreshControl,
  TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  getAllActivities, updateActivityStatus, isBackendRunning,
  Activity, ACTIVITY_ICONS, formatDate,
} from '../store';

const C = {
  bg: '#FFDBE5', rose: '#E27396', amaranth: '#EA9AB2',
  green: '#6D9F71', dark: '#337357', white: '#FFFFFF',
  txt: '#2D2D2D', grey: '#7A7A7A', lightGreen: '#EAF4EC',
  pending: '#F59E0B', rejected: '#EF4444',
};

type Filter = 'Pending' | 'Approved' | 'Rejected';

export default function AdminPanel() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<Filter>('Pending');
  const [refreshing, setRefreshing] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [mintingId, setMintingId] = useState<string | null>(null);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectActivity, setRejectActivity] = useState<Activity | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Detail modal
  const [detailModal, setDetailModal] = useState(false);
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);

  const load = useCallback(async () => {
    const [all, backendUp] = await Promise.all([
      getAllActivities(),
      isBackendRunning(),
    ]);
    // Sort: Pending first, then newest
    const sorted = [...all].sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (b.status === 'Pending' && a.status !== 'Pending') return 1;
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
    setActivities(sorted);
    setBackendOnline(backendUp);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = activities.filter(a => a.status === filter);
  const pendingCount = activities.filter(a => a.status === 'Pending').length;

  const shortAddr = (addr: string) =>
    addr ? addr.slice(0, 8) + '...' + addr.slice(-4) : 'N/A';

  // ── APPROVE & MINT ────────────────────────────────────────────────
  const handleApprove = (a: Activity) => {
    Alert.alert(
      'Approve & Mint Tokens?',
      `Approve "${a.type}" by ${a.studentName ?? 'student'}?\n\n` +
      `✅ +${a.pts} EcoPoints will be added to their balance\n` +
      `🪙 +${a.pts} CCT tokens will be minted\n` +
      `💼 Wallet: ${a.walletAddress ? shortAddr(a.walletAddress) : 'N/A'}\n\n` +
      (backendOnline
        ? '🔗 Backend connected — real tokens will be minted'
        : '⚠️ Backend offline — points saved locally, tokens mint when node starts'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✓ Approve & Mint',
          onPress: async () => {
            setMintingId(a.id);
            // FIX: correct 2-param call (no reason for approvals)
            const result = await updateActivityStatus(a.id, 'Approved');
            setMintingId(null);
            await load();

            if (result.blockchainMinted) {
              Alert.alert(
                '✅ Approved & Minted!',
                `${a.pts} CCT tokens minted to ${a.studentName}'s wallet!\n` +
                `Points balance updated. Student can now redeem rewards.`,
              );
            } else {
              Alert.alert(
                '✅ Approved!',
                `+${a.pts} EcoPoints added to ${a.studentName ?? 'student'}.\n\n` +
                `⚠️ Blockchain offline — tokens will mint when Hardhat node starts.`,
              );
            }
          },
        },
      ],
    );
  };

  // ── REJECT ────────────────────────────────────────────────────────
  const handleRejectPress = (a: Activity) => {
    setRejectActivity(a);
    setRejectReason('');
    setRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectActivity) return;
    setRejectModal(false);
    // FIX: pass optional reason as 3rd arg
    await updateActivityStatus(
      rejectActivity.id,
      'Rejected',
      rejectReason.trim() || undefined,
    );
    await load();
    Alert.alert(
      '❌ Activity Rejected',
      `"${rejectActivity.type}" by ${rejectActivity.studentName ?? 'student'} rejected.` +
      (rejectReason.trim() ? `\n\nReason sent: "${rejectReason.trim()}"` : ''),
    );
    setRejectActivity(null);
    setRejectReason('');
  };

  // ── VIEW DETAILS ──────────────────────────────────────────────────
  const handleViewDetails = (a: Activity) => {
    setDetailActivity(a);
    setDetailModal(true);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      <Header />

      {/* ── REJECT MODAL ── */}
      <Modal visible={rejectModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reject Activity</Text>
            <Text style={s.modalSub}>
              "{rejectActivity?.type}" by {rejectActivity?.studentName ?? 'student'}
            </Text>
            <Text style={s.modalLabel}>Reason (optional — sent to student):</Text>
            <TextInput
              style={s.modalInput}
              placeholder="e.g. Insufficient proof, wrong location..."
              placeholderTextColor={C.grey}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setRejectModal(false)}
              >
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalRejectBtn} onPress={confirmReject}>
                <Text style={s.modalRejectTxt}>✗ Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── DETAILS MODAL ── */}
      <Modal visible={detailModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              {ACTIVITY_ICONS[detailActivity?.type ?? ''] ?? '🍃'} {detailActivity?.type}
            </Text>
            {[
              ['Student', detailActivity?.studentName ?? 'N/A'],
              ['Email', detailActivity?.studentEmail ?? 'N/A'],
              ['Location', detailActivity?.location ?? 'N/A'],
              ['Points', `+${detailActivity?.pts} pts`],
              ['Status', detailActivity?.status ?? 'N/A'],
              ['Wallet', detailActivity?.walletAddress ? shortAddr(detailActivity.walletAddress) : 'N/A'],
              ['Submitted', detailActivity ? formatDate(detailActivity.submittedAt) : 'N/A'],
            ].map(([k, v]) => (
              <View key={k} style={s.detailRow2}>
                <Text style={s.detailKey}>{k}:</Text>
                <Text style={s.detailVal}>{v}</Text>
              </View>
            ))}
            {!!detailActivity?.description && (
              <View style={{ marginTop: 12 }}>
                <Text style={s.detailKey}>Description:</Text>
                <Text style={[s.detailVal, { marginTop: 4 }]}>{detailActivity.description}</Text>
              </View>
            )}
            {detailActivity?.status === 'Rejected' && !!detailActivity.rejectionReason && (
              <View style={[s.detailRow2, { flexDirection: 'column' }]}>
                <Text style={[s.detailKey, { color: C.rejected }]}>Rejection Reason:</Text>
                <Text style={[s.detailVal, { color: C.rejected, marginTop: 4 }]}>
                  {detailActivity.rejectionReason}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[s.modalCancelBtn, { marginTop: 20, borderColor: C.dark }]}
              onPress={() => setDetailModal(false)}
            >
              <Text style={[s.modalCancelTxt, { color: C.dark }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
        {/* Title bar */}
        <View style={s.titleBar}>
          <View>
            <Text style={s.pageTitle}>Admin Panel</Text>
            <Text style={s.pageSub}>Review & verify submissions</Text>
          </View>
          {pendingCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{pendingCount} pending</Text>
            </View>
          )}
        </View>

        {/* Backend / blockchain status banners */}
        <View style={s.banners}>
          <View style={[s.statusBanner, { backgroundColor: backendOnline ? '#E8F5E9' : '#FFF8E1' }]}>
            <View style={[s.statusDot, { backgroundColor: backendOnline ? C.green : C.pending }]} />
            <Text style={[s.statusTxt, { color: backendOnline ? C.dark : '#92400E' }]}>
              {backendOnline
                ? '🔗 Backend connected — approvals sync to MongoDB'
                : '⚠️ Backend offline — approvals saved locally'}
            </Text>
          </View>
        </View>

        {/* Minting indicator */}
        {mintingId && (
          <View style={s.mintingBanner}>
            <ActivityIndicator color="#5B21B6" size="small" style={{ marginRight: 8 }} />
            <Text style={{ color: '#5B21B6', fontSize: 13, fontWeight: '600' }}>
              ⛓ Minting CCT tokens on blockchain...
            </Text>
          </View>
        )}

        {/* Filter tabs */}
        <View style={s.tabRow}>
          {(['Pending', 'Approved', 'Rejected'] as Filter[]).map(f => {
            const count = activities.filter(a => a.status === f).length;
            return (
              <TouchableOpacity
                key={f}
                style={[s.tabBtn, filter === f && s.tabActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabTxt, filter === f && s.tabTxtActive]}>
                  {f}{count > 0 ? ` (${count})` : ''}
                </Text>
                {filter === f && <View style={s.tabLine} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Activity cards */}
        <View style={s.content}>
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>📋</Text>
              <Text style={s.emptyTitle}>No {filter.toLowerCase()} activities</Text>
              <Text style={s.emptyDesc}>
                {filter === 'Pending'
                  ? 'All caught up! No submissions awaiting review.'
                  : `No ${filter.toLowerCase()} activities to show.`}
              </Text>
            </View>
          ) : (
            filtered.map(a => {
              const isNew = Date.now() - new Date(a.submittedAt).getTime() < 24 * 60 * 60 * 1000;
              const isMintingThis = mintingId === a.id;
              return (
                <View key={a.id} style={[s.card, a.status === 'Pending' && s.cardPending]}>
                  {isNew && a.status === 'Pending' && (
                    <View style={s.newBadge}>
                      <Text style={s.newBadgeTxt}>NEW</Text>
                    </View>
                  )}

                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 18, marginRight: 8 }}>
                          {ACTIVITY_ICONS[a.type] ?? '🍃'}
                        </Text>
                        <Text style={s.cardTitle}>{a.type}</Text>
                      </View>
                      <Text style={s.cardLoc}>
                        📍 <Text style={{ fontWeight: '600' }}>{a.location}</Text>
                      </Text>
                      {!!a.description && (
                        <Text style={s.cardDesc} numberOfLines={2}>{a.description}</Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                      <Text style={s.studentTxt}>
                        👤 <Text style={{ fontWeight: '700' }}>{a.studentName ?? 'Unknown'}</Text>
                      </Text>
                      <Text style={s.dateTxt}>{formatDate(a.submittedAt)}</Text>
                      <Text style={s.ptsTxt}>+{a.pts} pts</Text>
                    </View>
                  </View>

                  {/* Status pill */}
                  <View style={[s.statusPill, {
                    backgroundColor:
                      a.status === 'Approved' ? '#E8F5E9'
                        : a.status === 'Pending' ? '#FFF8E1' : '#FFEBEE',
                  }]}>
                    <Text style={[s.statusLabel, {
                      color:
                        a.status === 'Approved' ? C.green
                          : a.status === 'Pending' ? C.pending : C.rejected,
                    }]}>
                      {a.status === 'Approved' ? '✅'
                        : a.status === 'Pending' ? '⏳' : '❌'} {a.status}
                    </Text>
                  </View>

                  {/* Rejection reason (if any) */}
                  {a.status === 'Rejected' && !!a.rejectionReason && (
                    <Text style={s.rejReasonTxt}>
                      Reason: {a.rejectionReason}
                    </Text>
                  )}

                  {/* Approve / Reject buttons (Pending only) */}
                  {a.status === 'Pending' && (
                    <View style={s.btnRow}>
                      <TouchableOpacity
                        style={[s.approveBtn, isMintingThis && { opacity: 0.6 }]}
                        onPress={() => !isMintingThis && handleApprove(a)}
                        activeOpacity={0.85}
                        disabled={isMintingThis}
                      >
                        {isMintingThis
                          ? <ActivityIndicator color={C.white} size="small" />
                          : <Text style={s.approveTxt}>✓ Approve & Mint</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.rejectBtn, isMintingThis && { opacity: 0.4 }]}
                        onPress={() => !isMintingThis && handleRejectPress(a)}
                        activeOpacity={0.85}
                        disabled={isMintingThis}
                      >
                        <Text style={s.rejectTxt}>✗ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    style={s.detailsBtn}
                    onPress={() => handleViewDetails(a)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.detailsTxt}>View Details</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        <View style={s.adminFooter}>
          <Text style={s.adminFooterTxt}>
            {activities.length} total · {pendingCount} pending review
          </Text>
          <Text style={s.adminBrand}>🌿 EcoLedger Admin Panel v1.0</Text>
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
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
  },
  pageTitle: { fontSize: 26, fontWeight: '800', color: C.dark },
  pageSub: { fontSize: 14, color: C.green, fontWeight: '500', marginTop: 3 },
  badge: { backgroundColor: C.rose, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  badgeTxt: { color: C.white, fontSize: 12, fontWeight: '800' },
  banners: { paddingHorizontal: 20, marginBottom: 8 },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusTxt: { fontSize: 12, fontWeight: '500', flex: 1 },
  mintingBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EDE9FE', marginHorizontal: 20, marginBottom: 8,
    borderRadius: 12, padding: 12,
  },
  tabRow: {
    flexDirection: 'row', backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  tabBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative',
  },
  tabActive: {},
  tabTxt: { fontSize: 13, fontWeight: '500', color: C.grey },
  tabTxtActive: { color: C.dark, fontWeight: '700' },
  tabLine: {
    position: 'absolute', bottom: 0, left: '15%', right: '15%',
    height: 2, backgroundColor: C.dark, borderRadius: 1,
  },
  content: { padding: 20 },
  card: {
    backgroundColor: C.white, borderRadius: 18, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 4, position: 'relative',
  },
  cardPending: { borderWidth: 1.5, borderColor: '#FFF0C0' },
  newBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: C.dark, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  newBadgeTxt: { color: C.white, fontSize: 10, fontWeight: '800' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.txt },
  cardLoc: { fontSize: 13, color: C.grey, marginTop: 4 },
  cardDesc: { fontSize: 12, color: C.grey, marginTop: 4, lineHeight: 16 },
  studentTxt: { fontSize: 13, color: C.grey },
  dateTxt: { fontSize: 12, color: C.grey, marginTop: 3 },
  ptsTxt: { fontSize: 13, color: C.green, fontWeight: '700', marginTop: 3 },
  statusPill: {
    alignSelf: 'flex-start', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8,
  },
  statusLabel: { fontSize: 13, fontWeight: '700' },
  rejReasonTxt: {
    fontSize: 12, color: C.rejected, fontStyle: 'italic',
    marginBottom: 10, lineHeight: 16,
  },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  approveBtn: {
    flex: 2, backgroundColor: C.dark, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  approveTxt: { color: C.white, fontSize: 13, fontWeight: '700' },
  rejectBtn: {
    flex: 1, backgroundColor: '#FFEBEE', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  rejectTxt: { color: C.rejected, fontSize: 13, fontWeight: '700' },
  detailsBtn: {
    backgroundColor: '#F5F5F5', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  detailsTxt: { color: C.dark, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: C.grey, textAlign: 'center', lineHeight: 20 },
  adminFooter: { alignItems: 'center', paddingVertical: 16 },
  adminFooterTxt: { fontSize: 13, color: C.grey },
  adminBrand: { fontSize: 12, color: C.green, fontWeight: '500', marginTop: 4 },
  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.white, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 28, maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20, fontWeight: '800', color: C.dark,
    marginBottom: 6, textAlign: 'center',
  },
  modalSub: { fontSize: 14, color: C.grey, textAlign: 'center', marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: C.dark, marginBottom: 8 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12,
    padding: 14, fontSize: 14, color: C.txt,
    minHeight: 90, backgroundColor: '#FAFAFA', marginBottom: 20,
  },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E0E0E0',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  modalCancelTxt: { fontSize: 14, fontWeight: '600', color: C.grey },
  modalRejectBtn: {
    flex: 1, backgroundColor: '#FFEBEE',
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  modalRejectTxt: { fontSize: 14, fontWeight: '700', color: C.rejected },
  detailRow2: {
    flexDirection: 'row', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  detailKey: { fontSize: 13, fontWeight: '600', color: C.txt, width: 100 },
  detailVal: { fontSize: 13, color: C.grey, flex: 1 },
});