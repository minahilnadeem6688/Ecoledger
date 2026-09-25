/**
 * EcoLedger — Submit Activity  (FIXED)
 * Location: ecoledger-app/app/submit-activity.tsx
 *
 * Fix: wallet gate — if student hasn't connected a wallet, show a blocker
 * screen that directs them to the Wallet page first.
 * Points can only be credited and tokens minted if a wallet address exists.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Animated, StatusBar, Alert, ActivityIndicator,
  Modal, FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { addActivity, ACTIVITY_POINTS, ACTIVITY_ICONS, hasWalletConnected } from '../store';

const C = {
  bg: '#FFDBE5', rose: '#E27396', amaranth: '#EA9AB2',
  green: '#6D9F71', dark: '#337357', white: '#FFFFFF',
  txt: '#2D2D2D', grey: '#7A7A7A', lightGreen: '#EAF4EC',
  border: '#E0E0E0', err: '#D32F2F', errBg: '#FFEBEE', ph: '#B0B0B0',
};
const TYPES = Object.keys(ACTIVITY_POINTS);

export default function SubmitActivity() {
  const router = useRouter();

  // Wallet gate
  const [walletChecked, setWalletChecked] = useState(false);
  const [walletOk, setWalletOk] = useState(false);

  // Form state
  const [type, setType] = useState('');
  const [desc, setDesc] = useState('');
  const [loc, setLoc] = useState('');
  const [img, setImg] = useState<string | null>(null);
  const [typeErr, setTypeErr] = useState('');
  const [descErr, setDescErr] = useState('');
  const [locErr, setLocErr] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // ── Check wallet on every focus ─────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    (async () => {
      const ok = await hasWalletConnected();
      setWalletOk(ok);
      setWalletChecked(true);
    })();
  }, []));

  useEffect(() => {
    if (walletOk) {
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 9 }).start();
    }
  }, [walletOk]);

  const fu = (a: Animated.Value) => ({
    opacity: a,
    transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });
  const iBox = (f: string, err: boolean) => [
    s.inputBox,
    focused === f && !err && s.inputFocused,
    err && s.inputError,
  ];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to upload proof.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!r.canceled) setImg(r.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow camera access.'); return; }
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!r.canceled) setImg(r.assets[0].uri);
  };

  const handleSubmit = async () => {
    setTypeErr(''); setDescErr(''); setLocErr('');
    let ok = true;
    if (!type) { setTypeErr('Select an activity type'); ok = false; }
    if (!desc.trim()) { setDescErr('Describe your activity'); ok = false; }
    else if (desc.trim().length < 10) { setDescErr('Min 10 characters'); ok = false; }
    if (!loc.trim()) { setLocErr('Enter a location'); ok = false; }
    if (!ok) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    await addActivity({ type, description: desc.trim(), location: loc.trim(), imageUri: img ?? undefined });
    setLoading(false);
    setDone(true);
    Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }).start();
  };

  const pts = ACTIVITY_POINTS[type] ?? 0;

  // ── Loading / checking wallet ──────────────────────────────────────────────
  if (!walletChecked) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
        <Header />
        <View style={s.centerWrap}>
          <ActivityIndicator size="large" color={C.dark} />
        </View>
      </View>
    );
  }

  // ── WALLET GATE — student hasn't connected a wallet yet ────────────────────
  if (!walletOk) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
        <Header />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.gateWrap}>
            <View style={s.gateCard}>
              <Text style={s.gateIcon}>🔗</Text>
              <Text style={s.gateTitle}>Connect Your Wallet First</Text>
              <Text style={s.gateDesc}>
                You need to connect an Ethereum wallet before submitting activities.
              </Text>
              <Text style={s.gateDesc}>
                When an admin approves your activity, EcoPoints and CCT tokens are sent directly to your wallet. Without a connected wallet, we have nowhere to send them.
              </Text>

              <View style={s.gateSteps}>
                <Text style={s.gateStepTitle}>What you need to do:</Text>
                <Text style={s.gateStep}>1. Go to the Wallet page</Text>
                <Text style={s.gateStep}>2. Tap "Connect My Wallet"</Text>
                <Text style={s.gateStep}>3. Paste your Ethereum address (0x...)</Text>
                <Text style={s.gateStep}>4. Come back and submit your activity</Text>
              </View>

              <TouchableOpacity
                style={s.gateBtn}
                onPress={() => router.push('/wallet' as any)}
                activeOpacity={0.85}>
                <Text style={s.gateBtnTxt}>🔗 Go to Wallet Page</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.gateBackBtn}
                onPress={() => router.back()}
                activeOpacity={0.8}>
                <Text style={s.gateBackTxt}>← Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Footer />
        </ScrollView>
      </View>
    );
  }

  // ── SUCCESS screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
        <Header />
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.successWrap}>
            <Animated.View style={[s.successCard, { transform: [{ scale: successScale }] }]}>
              <Text style={{ fontSize: 52, marginBottom: 12, textAlign: 'center' }}>🎉</Text>
              <Text style={s.successTitle}>Submitted!</Text>
              <Text style={s.successDesc}>
                Your <Text style={{ fontWeight: '700', color: C.dark }}>{type}</Text> activity is pending admin verification.
              </Text>
              <View style={s.ptsBadge}>
                <Text style={s.ptsBadgeLabel}>You'll earn</Text>
                <Text style={s.ptsBadgeNum}>+{pts} pts</Text>
                <Text style={s.ptsBadgeLabel}>once approved</Text>
              </View>
              <View style={s.chainNote}>
                <Text>🔗 </Text>
                <Text style={s.chainTxt}>Points and CCT tokens will be sent to your connected wallet after approval.</Text>
              </View>
              <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)')} activeOpacity={0.85}>
                <Text style={s.btnTxt}>Back to Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: C.white, marginTop: 10, borderWidth: 1, borderColor: C.dark }]}
                onPress={() => {
                  setDone(false); setType(''); setDesc(''); setLoc(''); setImg(null);
                  successScale.setValue(0);
                  fadeAnim.setValue(0);
                  Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 9 }).start();
                }}
                activeOpacity={0.85}>
                <Text style={[s.btnTxt, { color: C.dark }]}>Submit Another</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
          <Footer />
        </ScrollView>
      </View>
    );
  }

  // ── MAIN FORM ──────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />
      <Header />

      <Modal visible={showDrop} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowDrop(false)}>
          <View style={s.dropModal}>
            <Text style={s.dropTitle}>Select Activity Type</Text>
            <FlatList
              data={TYPES}
              keyExtractor={t => t}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.dropItem, type === item && s.dropItemActive]}
                  onPress={() => { setType(item); setTypeErr(''); setShowDrop(false); }}>
                  <Text style={{ fontSize: 20, marginRight: 12 }}>{ACTIVITY_ICONS[item]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.dropLabel, type === item && { color: C.dark }]}>{item}</Text>
                    <Text style={s.dropPts}>+{ACTIVITY_POINTS[item]} pts on approval</Text>
                  </View>
                  {type === item && <Text style={{ color: C.dark, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <View style={s.titleBar}>
          <Text style={s.pageTitle}>Submit Activity</Text>
          <Text style={s.pageSub}>Log your eco-friendly action</Text>
        </View>

        {/* Wallet connected badge */}
        <View style={s.walletBadge}>
          <Text style={s.walletBadgeTxt}>✅ Wallet connected — points will be credited on approval</Text>
        </View>

        <Animated.View style={[s.card, fu(fadeAnim)]}>
          {!!type && (
            <View style={s.ptsBadgeTop}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>{ACTIVITY_ICONS[type]}</Text>
              <Text style={{ flex: 1, fontSize: 13, color: C.dark }}>
                <Text style={{ fontWeight: '700' }}>{type}</Text> — earn{' '}
                <Text style={{ fontWeight: '800' }}>+{pts} pts</Text> on approval
              </Text>
            </View>
          )}

          <Text style={s.label}>Activity Type *</Text>
          <TouchableOpacity
            style={[s.dropdown, !!typeErr && s.inputError]}
            onPress={() => setShowDrop(true)}
            activeOpacity={0.8}>
            <Text style={[s.dropValue, !type && { color: C.ph }]}>
              {type ? `${ACTIVITY_ICONS[type]}  ${type}` : 'Select Activity Type'}
            </Text>
            <Text style={{ color: C.grey }}>▾</Text>
          </TouchableOpacity>
          {!!typeErr && <Text style={s.err}>⚠ {typeErr}</Text>}

          <Text style={s.label}>Description *</Text>
          <View style={iBox('desc', !!descErr)}>
            <TextInput
              style={s.textarea}
              placeholder="Describe your activity in detail..."
              placeholderTextColor={C.ph}
              value={desc}
              onChangeText={t => { setDesc(t); setDescErr(''); }}
              onFocus={() => setFocused('desc')}
              onBlur={() => setFocused(null)}
              multiline numberOfLines={4} textAlignVertical="top"
            />
          </View>
          {!!descErr && <Text style={s.err}>⚠ {descErr}</Text>}

          <Text style={s.label}>Location *</Text>
          <View style={iBox('loc', !!locErr)}>
            <TextInput
              style={s.input}
              placeholder="e.g. Campus Block C, Community Park"
              placeholderTextColor={C.ph}
              value={loc}
              onChangeText={t => { setLoc(t); setLocErr(''); }}
              onFocus={() => setFocused('loc')}
              onBlur={() => setFocused(null)}
            />
          </View>
          {!!locErr && <Text style={s.err}>⚠ {locErr}</Text>}

          <Text style={s.label}>Proof Image (optional)</Text>
          <TouchableOpacity
            style={[s.uploadBox, !!img && s.uploadFilled]}
            onPress={() => Alert.alert('Upload Proof', '', [
              { text: '📷 Camera', onPress: takePhoto },
              { text: '🖼️ Gallery', onPress: pickImage },
              { text: 'Cancel', style: 'cancel' },
            ])}
            activeOpacity={0.8}>
            {img
              ? <><Text style={{ fontSize: 28, marginBottom: 4 }}>✅</Text><Text style={s.uploadTxt}>Image attached</Text><Text style={s.uploadSub}>Tap to change</Text></>
              : <><Text style={{ fontSize: 28, marginBottom: 6 }}>📷</Text><Text style={s.uploadTxt}>Tap to upload image</Text><Text style={s.uploadSub}>Photo proof speeds up verification</Text></>
            }
          </TouchableOpacity>

          <Text style={s.verifyNote}>🔍 Activities are verified by admins before rewards are issued</Text>

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.75 }]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}>
            {loading
              ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color={C.white} style={{ marginRight: 10 }} />
                  <Text style={s.btnTxt}>Submitting to blockchain...</Text>
                </View>
              : <Text style={s.btnTxt}>Submit Activity</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        <Footer />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: {},
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },

  // Wallet gate
  gateWrap: { padding: 24, alignItems: 'center' },
  gateCard: {
    backgroundColor: C.white, borderRadius: 24, padding: 28, width: '100%',
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 5,
  },
  gateIcon: { fontSize: 52, marginBottom: 14 },
  gateTitle: { fontSize: 22, fontWeight: '800', color: C.dark, marginBottom: 12, textAlign: 'center' },
  gateDesc: { fontSize: 14, color: C.grey, textAlign: 'center', lineHeight: 22, marginBottom: 10 },
  gateSteps: {
    backgroundColor: C.lightGreen, borderRadius: 14, padding: 16,
    width: '100%', marginVertical: 16, borderLeftWidth: 3, borderLeftColor: C.green,
  },
  gateStepTitle: { fontSize: 13, fontWeight: '700', color: C.dark, marginBottom: 8 },
  gateStep: { fontSize: 13, color: C.dark, lineHeight: 24 },
  gateBtn: {
    backgroundColor: C.dark, borderRadius: 14, paddingVertical: 16,
    paddingHorizontal: 32, alignItems: 'center', width: '100%', marginBottom: 12,
    shadowColor: C.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  gateBtnTxt: { color: C.white, fontSize: 16, fontWeight: '700' },
  gateBackBtn: { paddingVertical: 12 },
  gateBackTxt: { fontSize: 14, color: C.grey, fontWeight: '600' },

  // Wallet badge (shown when wallet IS connected)
  walletBadge: {
    marginHorizontal: 20, marginBottom: 8, backgroundColor: '#E8F5E9',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
    borderLeftWidth: 3, borderLeftColor: C.green,
  },
  walletBadgeTxt: { fontSize: 13, color: C.dark, fontWeight: '600' },

  // Form
  titleBar: { paddingHorizontal: 20, paddingVertical: 20 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: C.dark },
  pageSub: { fontSize: 14, color: C.grey, marginTop: 3 },
  card: {
    marginHorizontal: 20, marginBottom: 28, backgroundColor: C.white,
    borderRadius: 24, padding: 24, shadowColor: C.rose,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6,
  },
  ptsBadgeTop: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.lightGreen,
    borderRadius: 12, padding: 12, marginBottom: 18, borderLeftWidth: 3, borderLeftColor: C.green,
  },
  label: { fontSize: 13, fontWeight: '600', color: C.dark, marginBottom: 8, marginTop: 6 },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12, backgroundColor: '#FAFAFA',
    paddingHorizontal: 16, height: 52, marginBottom: 6,
  },
  dropValue: { fontSize: 15, color: C.txt, flex: 1 },
  inputBox: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, backgroundColor: '#FAFAFA', marginBottom: 6 },
  inputFocused: { borderColor: C.green, backgroundColor: C.white },
  inputError: { borderColor: C.err, backgroundColor: C.errBg },
  input: { height: 50, paddingHorizontal: 16, fontSize: 15, color: C.txt },
  textarea: { padding: 14, fontSize: 15, color: C.txt, minHeight: 100 },
  err: { color: C.err, fontSize: 12, marginBottom: 8, fontWeight: '500' },
  uploadBox: {
    borderWidth: 1.5, borderColor: '#C8DDC9', borderRadius: 14, borderStyle: 'dashed',
    backgroundColor: C.lightGreen, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 28, marginBottom: 6,
  },
  uploadFilled: { backgroundColor: '#EAF6EC', borderColor: C.green, borderStyle: 'solid' },
  uploadTxt: { fontSize: 15, fontWeight: '600', color: C.dark, marginBottom: 2 },
  uploadSub: { fontSize: 12, color: C.grey },
  verifyNote: { fontSize: 12, color: C.grey, textAlign: 'center', marginVertical: 14 },
  btn: {
    backgroundColor: C.dark, borderRadius: 12, height: 52, alignItems: 'center',
    justifyContent: 'center', marginTop: 4, shadowColor: C.dark,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5,
  },
  btnTxt: { color: C.white, fontSize: 16, fontWeight: '700' },

  // Dropdown modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dropModal: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' },
  dropTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 16, textAlign: 'center' },
  dropItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  dropItemActive: { backgroundColor: C.lightGreen, borderRadius: 12, paddingHorizontal: 8 },
  dropLabel: { fontSize: 15, fontWeight: '600', color: C.txt },
  dropPts: { fontSize: 12, color: C.green, marginTop: 2 },

  // Success screen
  successWrap: { padding: 24, alignItems: 'center' },
  successCard: {
    backgroundColor: C.white, borderRadius: 24, padding: 28, width: '100%',
    maxWidth: 440, alignItems: 'center', shadowColor: C.green,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8,
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: C.dark, marginBottom: 10 },
  successDesc: { fontSize: 14, color: C.grey, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  ptsBadge: {
    backgroundColor: C.lightGreen, borderRadius: 14, paddingVertical: 14,
    paddingHorizontal: 28, alignItems: 'center', marginBottom: 16,
  },
  ptsBadgeLabel: { fontSize: 12, color: C.grey },
  ptsBadgeNum: { fontSize: 36, fontWeight: '800', color: C.dark },
  chainNote: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#F0F7F2',
    borderRadius: 12, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: C.green,
  },
  chainTxt: { flex: 1, fontSize: 12, color: C.dark, lineHeight: 18 },
});