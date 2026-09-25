/**
 * EcoLedger — My Wallet
 * Location: ecoledger-app/app/wallet.tsx
 *
 * Flow:
 *  1. Tap "Open MetaMask" → opens MetaMask app via deep link
 *  2. User copies their address from MetaMask
 *  3. User comes back, pastes address → it saves to backend + local
 *  4. On every focus, syncUserFromBackend() pulls live points from MongoDB
 *  5. No mock/hardcoded data — everything is real from backend
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Alert, RefreshControl, Clipboard,
  TextInput, Modal, Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {
  syncUserFromBackend, getUser, getActivities,
  EcoUser, Activity, shortWallet, formatDate,
  isBackendRunning, connectExternalWallet,
  disconnectExternalWallet, ACTIVITY_ICONS,
} from '../store';

const C = {
  bg: '#FFDBE5', green: '#6D9F71', dark: '#337357',
  white: '#FFFFFF', txt: '#2D2D2D', grey: '#7A7A7A',
  lightGreen: '#EAF4EC', rose: '#E27396',
};

// MetaMask deep link — opens the MetaMask app directly
const METAMASK_DEEP_LINK = 'metamask://';

export default function Wallet() {
  const [user, setUser]             = useState<EcoUser | null>(null);
  const [approvedActs, setApprovedActs] = useState<Activity[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [address, setAddress]       = useState('');
  const [addrError, setAddrError]   = useState('');
  const [saving, setSaving]         = useState(false);

  // Pull live data from backend on every screen focus
  const load = useCallback(async () => {
    const [synced, acts, online] = await Promise.all([
      syncUserFromBackend(),
      getActivities(),
      isBackendRunning(),
    ]);
    setUser(synced ?? await getUser());
    setBackendOnline(online);
    setApprovedActs(acts.filter(a => a.status === 'Approved'));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const walletAddr  = user?.connectedWallet ?? user?.walletAddress ?? null;
  const isConnected = !!walletAddr && /^0x[0-9a-fA-F]{40}$/.test(walletAddr);
  const cct         = user?.cctTokens  ?? 0;
  const pts         = user?.ecoPoints  ?? 0;

  // Open MetaMask app
  const openMetaMask = async () => {
    const canOpen = await Linking.canOpenURL(METAMASK_DEEP_LINK);
    if (canOpen) {
      await Linking.openURL(METAMASK_DEEP_LINK);
    } else {
      // MetaMask not installed — open download page
      Alert.alert(
        'MetaMask Not Found',
        'Install MetaMask first, then come back to connect your wallet.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Download MetaMask', onPress: () => Linking.openURL('https://metamask.io/download/') },
        ],
      );
    }
  };

  const handleSaveAddress = async () => {
    setAddrError('');
    const addr = address.trim();
    if (!addr) { setAddrError('Paste your wallet address from MetaMask.'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setAddrError('Invalid address. Must start with 0x and be exactly 42 characters.');
      return;
    }
    setSaving(true);
    const result = await connectExternalWallet(addr);
    setSaving(false);
    if (!result.success) { setAddrError(result.error ?? 'Failed to save.'); return; }
    setShowModal(false);
    setAddress('');
    await load();
    Alert.alert('✅ Wallet Connected!',
      `Address saved: ${addr.slice(0, 10)}...${addr.slice(-4)}\n\n` +
      `CCT tokens will be minted here when admin approves your activities.`
    );
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Wallet?', 'Your EcoPoints are preserved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        await disconnectExternalWallet(); await load();
      }},
    ]);
  };

  const copyAddr = () => {
    if (walletAddr) { Clipboard.setString(walletAddr); Alert.alert('Copied!', 'Address copied.'); }
  };

  // ── Connect Modal ───────────────────────────────────────────────────────────
  const ConnectModal = () => (
    <Modal visible={showModal} transparent animationType="slide">
      <View style={s.overlay}>
        <View style={s.modalBox}>
          <Text style={s.modalTitle}>Connect MetaMask Wallet</Text>

          {/* Step 1 — Open MetaMask */}
          <View style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumTxt}>1</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>Open MetaMask & copy your address</Text>
              <Text style={s.stepDesc}>Make sure you are on the Hardhat Local network in MetaMask, then tap your account address to copy it.</Text>
              <TouchableOpacity style={s.mmBtn} onPress={openMetaMask}>
                <Text style={s.mmBtnTxt}>🦊 Open MetaMask</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Step 2 — Paste address */}
          <View style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumTxt}>2</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>Paste your address below</Text>
              <TextInput
                style={[s.input, !!addrError && s.inputErr]}
                placeholder="0x... (42 characters)"
                placeholderTextColor="#B0B0B0"
                value={address}
                onChangeText={t => { setAddress(t); setAddrError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!addrError && <Text style={s.errTxt}>⚠ {addrError}</Text>}
            </View>
          </View>

          <View style={s.secBox}>
            <Text style={s.secTxt}>🔒 Only your public address is saved. Your private key never leaves MetaMask.</Text>
          </View>

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveAddress} disabled={saving}>
            <Text style={s.saveBtnTxt}>{saving ? 'Saving...' : 'Connect Wallet'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn}
            onPress={() => { setShowModal(false); setAddress(''); setAddrError(''); }}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ── Not Connected ───────────────────────────────────────────────────────────
  const NotConnected = () => (
    <View style={s.notConnCard}>
      <Text style={s.ncIcon}>🔗</Text>
      <Text style={s.ncTitle}>No Wallet Connected</Text>
      <Text style={s.ncDesc}>
        Connect your MetaMask wallet to receive CCT tokens when your eco activities are approved.
      </Text>

      {/* Hardhat network info box */}
      <View style={s.netBox}>
        <Text style={s.netTitle}>Add Hardhat Network in MetaMask:</Text>
        {([
          ['Network Name', 'Hardhat Local'],
          ['RPC URL',      'http://127.0.0.1:8545'],
          ['Chain ID',     '31337'],
          ['Symbol',       'ETH'],
        ] as [string, string][]).map(([k, v]) => (
          <TouchableOpacity key={k} style={s.netRow}
            onPress={() => { Clipboard.setString(v); Alert.alert('Copied!', `${k}: ${v}`); }}>
            <Text style={s.netKey}>{k}</Text>
            <Text style={s.netVal}>{v} 📋</Text>
          </TouchableOpacity>
        ))}
        <Text style={s.netNote}>Tap any value to copy it</Text>
      </View>

      {/* Open MetaMask button */}
      <TouchableOpacity style={s.mmMainBtn} onPress={openMetaMask}>
        <Text style={s.mmMainBtnTxt}>🦊 Open MetaMask</Text>
      </TouchableOpacity>

      {/* Connect button */}
      <TouchableOpacity style={s.connectBtn} onPress={() => setShowModal(true)}>
        <Text style={s.connectBtnTxt}>🔗 I Have My Address — Connect</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Connected ───────────────────────────────────────────────────────────────
  const Connected = () => (
    <>
      {/* Backend status */}
      <View style={[s.statusBar, { backgroundColor: backendOnline ? '#E8F5E9' : '#FFF8E1' }]}>
        <View style={[s.dot, { backgroundColor: backendOnline ? C.green : '#F59E0B' }]} />
        <Text style={[s.statusTxt, { color: backendOnline ? C.dark : '#92400E' }]}>
          Backend: {backendOnline ? 'Connected ✓' : 'Offline'}
        </Text>
      </View>

      {/* Wallet card — all real data from backend */}
      <View style={s.card}>
        <View style={s.cardCircle1} />
        <View style={s.cardCircle2} />

        <Text style={s.cardLabel}>Connected Wallet</Text>
        <View style={s.addrRow}>
          <Text style={s.addrTxt}>{shortWallet(walletAddr ?? '')}</Text>
          <TouchableOpacity onPress={copyAddr} style={{ marginLeft: 10 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }}>📋</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.bigNum}>{cct}</Text>
        <Text style={s.bigNumLabel}>CCT Tokens</Text>
        <Text style={s.ptsLabel}>🌿 {pts} EcoPoints</Text>

        <View style={s.connRow}>
          <View style={s.connDot} />
          <Text style={s.connTxt}>Wallet connected ✓</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={s.btnRow}>
        <TouchableOpacity style={s.refreshBtn} onPress={async () => { const u = await syncUserFromBackend(); if (u) { setUser(u); Alert.alert('Refreshed ✅', `EcoPoints: ${u.ecoPoints}\nCCT: ${u.cctTokens}`); } }}>
          <Text style={s.refreshTxt}>🔄 Refresh</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.changeBtn} onPress={() => setShowModal(true)}>
          <Text style={s.changeTxt}>⟳ Change</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.discBtn} onPress={handleDisconnect}>
          <Text style={s.discTxt}>✗</Text>
        </TouchableOpacity>
      </View>

      {/* Token details — real data */}
      <View style={s.detailCard}>
        <Text style={s.detailTitle}>Token Details</Text>
        {([
          ['Token',      'Campus Carbon Token (CCT)'],
          ['Network',    'Hardhat Local'],
          ['Standard',   'ERC-20'],
          ['Wallet',     shortWallet(walletAddr ?? '')],
          ['CCT Balance',`${cct} CCT`],
          ['EcoPoints',  `${pts} pts`],
        ] as [string, string][]).map(([k, v]) => (
          <View key={k} style={s.detailRow}>
            <Text style={s.detailKey}>{k}:</Text>
            <Text style={s.detailVal}>{v}</Text>
          </View>
        ))}
      </View>

      {/* How it works */}
      <View style={s.howBox}>
        <Text style={s.howTitle}>💡 How Tokens Work</Text>
        <Text style={s.howTxt}>
          1. Submit an eco activity{'\n'}
          2. Admin reviews and taps Approve & Mint{'\n'}
          3. EcoPoints added to your account in MongoDB{'\n'}
          4. CCT tokens minted to this wallet on Hardhat{'\n'}
          5. Redeem points for rewards on the Rewards page
        </Text>
      </View>

      {/* Real earning history from backend */}
      <Text style={s.histTitle}>Earning History</Text>
      {approvedActs.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyTxt}>No approved activities yet</Text>
          <Text style={s.emptyDesc}>Submit eco activities to earn CCT tokens.</Text>
        </View>
      ) : (
        <View style={s.histCard}>
          {approvedActs.map((a, i) => (
            <View key={a.id} style={[s.histRow, i < approvedActs.length - 1 && s.histBorder]}>
              <View style={s.histIcon}>
                <Text style={{ fontSize: 18 }}>{ACTIVITY_ICONS[a.type] ?? '🍃'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.histType}>{a.type}</Text>
                <Text style={s.histDate}>{formatDate(a.submittedAt)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.histPts}>+{a.pts} pts</Text>
                <Text style={s.histMinted}>CCT minted ✓</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      <Header />
      <ConnectModal />
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            tintColor={C.dark} />
        }>
        <View style={s.titleBar}>
          <Text style={s.pageTitle}>My Wallet</Text>
          <Text style={s.pageSub}>Blockchain Overview 🔗</Text>
        </View>
        <View style={s.content}>
          {isConnected ? <Connected /> : <NotConnected />}
        </View>
        <Footer />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFDBE5' },
  titleBar: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#337357' },
  pageSub: { fontSize: 14, color: '#6D9F71', fontWeight: '500', marginTop: 3 },
  content: { padding: 20 },

  // Not connected
  notConnCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 5 },
  ncIcon: { fontSize: 52, marginBottom: 12 },
  ncTitle: { fontSize: 22, fontWeight: '800', color: '#337357', marginBottom: 8 },
  ncDesc: { fontSize: 14, color: '#7A7A7A', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  netBox: { backgroundColor: '#EAF4EC', borderRadius: 14, padding: 16, width: '100%', marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#337357' },
  netTitle: { fontSize: 13, fontWeight: '700', color: '#337357', marginBottom: 10 },
  netRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#D4EAD8' },
  netKey: { fontSize: 12, fontWeight: '600', color: '#2D2D2D' },
  netVal: { fontSize: 12, color: '#337357', fontWeight: '600' },
  netNote: { fontSize: 11, color: '#7A7A7A', marginTop: 8, textAlign: 'center' },
  mmMainBtn: { backgroundColor: '#F6851B', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%', marginBottom: 12 },
  mmMainBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  connectBtn: { backgroundColor: '#337357', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center', width: '100%' },
  connectBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  // Connected
  statusBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusTxt: { fontSize: 12, fontWeight: '500', flex: 1 },
  card: { borderRadius: 20, backgroundColor: '#337357', padding: 24, marginBottom: 14, overflow: 'hidden' },
  cardCircle1: { position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: 80, borderWidth: 30, borderColor: 'rgba(255,255,255,0.08)' },
  cardCircle2: { position: 'absolute', left: -20, bottom: -20, width: 100, height: 100, borderRadius: 50, borderWidth: 20, borderColor: 'rgba(255,255,255,0.05)' },
  cardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  addrRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  addrTxt: { fontSize: 18, color: '#FFFFFF', fontWeight: '600' },
  bigNum: { fontSize: 52, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  bigNumLabel: { fontSize: 18, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2, marginBottom: 6 },
  ptsLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 14 },
  connRow: { flexDirection: 'row', alignItems: 'center' },
  connDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6EE7B7', marginRight: 6 },
  connTxt: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  btnRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  refreshBtn: { flex: 3, backgroundColor: '#6D9F71', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  refreshTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  changeBtn: { flex: 2, backgroundColor: '#4A7C5C', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  changeTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  discBtn: { flex: 1, backgroundColor: '#FFEBEE', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  discTxt: { color: '#EF4444', fontSize: 16, fontWeight: '700' },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, marginBottom: 14 },
  detailTitle: { fontSize: 17, fontWeight: '700', color: '#337357', marginBottom: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  detailKey: { fontSize: 14, fontWeight: '600', color: '#2D2D2D' },
  detailVal: { fontSize: 14, color: '#7A7A7A' },
  howBox: { backgroundColor: '#EAF4EC', borderRadius: 14, padding: 16, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: '#337357' },
  howTitle: { fontSize: 14, fontWeight: '700', color: '#337357', marginBottom: 8 },
  howTxt: { fontSize: 13, color: '#2D2D2D', lineHeight: 22 },
  histTitle: { fontSize: 17, fontWeight: '700', color: '#2D2D2D', marginBottom: 12 },
  histCard: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16, marginBottom: 20 },
  histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  histBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  histIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EAF4EC', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  histType: { fontSize: 14, fontWeight: '600', color: '#2D2D2D' },
  histDate: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
  histPts: { fontSize: 15, fontWeight: '700', color: '#337357' },
  histMinted: { fontSize: 11, color: '#6D9F71', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 30 },
  emptyTxt: { fontSize: 15, fontWeight: '600', color: '#337357', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#7A7A7A', textAlign: 'center' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#337357', textAlign: 'center', marginBottom: 20 },
  step: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' },
  stepNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#337357', alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0 },
  stepNumTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  stepTitle: { fontSize: 14, fontWeight: '700', color: '#2D2D2D', marginBottom: 4 },
  stepDesc: { fontSize: 13, color: '#7A7A7A', lineHeight: 20, marginBottom: 10 },
  mmBtn: { backgroundColor: '#F6851B', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start' },
  mmBtnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  input: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12, backgroundColor: '#FAFAFA', height: 50, paddingHorizontal: 14, fontSize: 14, color: '#2D2D2D', marginTop: 8 },
  inputErr: { borderColor: '#D32F2F', backgroundColor: '#FFEBEE' },
  errTxt: { color: '#D32F2F', fontSize: 12, marginTop: 4 },
  secBox: { backgroundColor: '#EAF4EC', borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#6D9F71' },
  secTxt: { fontSize: 12, color: '#337357', lineHeight: 18 },
  saveBtn: { backgroundColor: '#337357', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  saveBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelTxt: { fontSize: 14, color: '#7A7A7A', fontWeight: '600' },
});