/**
 * EcoLedger — Login / Register
 * Location: ecoledger-app/app/login.tsx
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Animated, StatusBar, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  loginStudent, createStudentInDB, saveUser,
  generateRealWallet, isBackendRunning,
} from '../store';

const C = {
  bg: '#FFDBE5', rose: '#E27396', amaranth: '#EA9AB2',
  green: '#6D9F71', dark: '#337357', white: '#FFFFFF',
  txt: '#2D2D2D', grey: '#7A7A7A', lightGreen: '#EAF4EC',
  border: '#E0E0E0', err: '#D32F2F', errBg: '#FFEBEE', ph: '#B0B0B0',
};

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [nameErr, setNameErr] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [passErr, setPassErr] = useState('');
  const [confirmErr, setConfirmErr] = useState('');

  const [focused, setFocused] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 9 }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 9 }),
    ]).start();
    isBackendRunning().then(setBackendOnline);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setNameErr(''); setEmailErr(''); setPassErr(''); setConfirmErr('');
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.6, duration: 120, useNativeDriver: true }),
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 9 }),
    ]).start();
  };

  const iBox = (f: string, err: boolean) => [
    s.inputBox,
    focused === f && !err && s.inputFocused,
    err && s.inputError,
  ];

  const clearErrors = () => {
    setNameErr(''); setEmailErr(''); setPassErr(''); setConfirmErr('');
  };

  // ─── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    clearErrors();
    let ok = true;
    if (!email.trim()) { setEmailErr('Enter your email'); ok = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailErr('Enter a valid email'); ok = false; }
    if (!password) { setPassErr('Enter your password'); ok = false; }
    if (!ok) return;

    setLoading(true);
    try {
      const user = await loginStudent(email.trim().toLowerCase(), password);
      if (user) {
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert(
          'Login Failed',
          backendOnline
            ? 'Incorrect email or password.'
            : 'Backend offline — no local account found for this email.',
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Register ─────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    clearErrors();
    let ok = true;
    if (!name.trim() || name.trim().length < 2) { setNameErr('Enter your full name (min 2 chars)'); ok = false; }
    if (!email.trim()) { setEmailErr('Enter your email'); ok = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailErr('Enter a valid email'); ok = false; }
    if (!password || password.length < 6) { setPassErr('Password must be at least 6 characters'); ok = false; }
    if (password !== confirmPassword) { setConfirmErr('Passwords do not match'); ok = false; }
    if (!ok) return;

    setLoading(true);
    try {
      // Generate a real Ethereum wallet for this student
      const { address, privateKey } = generateRealWallet();

      const newUser = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        walletAddress: address,
      };

      if (backendOnline) {
        const result = await createStudentInDB(newUser);
        if (result && (result._id || result.student?._id)) {
          const raw = result.student ?? result;
          await saveUser({
            _id: raw._id,
            name: raw.name ?? name.trim(),
            email: raw.email ?? email.trim().toLowerCase(),
            walletAddress: raw.walletAddress ?? address,
            ecoPoints: raw.ecoPoints ?? 0,
            cctTokens: raw.cctTokens ?? 0,
          });
          Alert.alert(
            '🎉 Account Created!',
            `Welcome, ${name.trim()}!\n\nYour Ethereum wallet has been generated:\n${address.slice(0, 10)}...${address.slice(-4)}\n\nKeep your private key safe:\n${privateKey.slice(0, 10)}...`,
            [{ text: 'Get Started', onPress: () => router.replace('/(tabs)' as any) }],
          );
          return;
        }
        // Backend returned an error
        Alert.alert('Registration Failed', result?.message ?? 'Could not create account. Email may already be in use.');
      } else {
        // Offline fallback — save locally
        await saveUser({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          walletAddress: address,
          ecoPoints: 0,
          cctTokens: 0,
        });
        Alert.alert(
          '✅ Account Created (Offline)',
          `Welcome, ${name.trim()}!\n\nAccount saved locally. Connect backend to sync.\n\nWallet: ${address.slice(0, 10)}...${address.slice(-4)}`,
          [{ text: 'Get Started', onPress: () => router.replace('/(tabs)' as any) }],
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <Animated.View style={[s.hero, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={s.leaf}>🌿</Text>
            <Text style={s.brand}>EcoLedger</Text>
            <Text style={s.tagline}>Earn tokens for sustainable actions</Text>
          </Animated.View>

          {/* Backend status pill */}
          <View style={s.statusWrap}>
            <View style={[s.statusPill, { backgroundColor: backendOnline ? '#E8F5E9' : '#FFF8E1' }]}>
              <View style={[s.statusDot, { backgroundColor: backendOnline ? C.green : '#F59E0B' }]} />
              <Text style={[s.statusTxt, { color: backendOnline ? C.dark : '#92400E' }]}>
                {backendOnline ? 'Backend connected ✓' : 'Backend offline — local mode'}
              </Text>
            </View>
          </View>

          {/* Mode toggle */}
          <View style={s.toggleRow}>
            <TouchableOpacity
              style={[s.toggleBtn, mode === 'login' && s.toggleActive]}
              onPress={() => switchMode('login')}
              activeOpacity={0.8}
            >
              <Text style={[s.toggleTxt, mode === 'login' && s.toggleTxtActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, mode === 'register' && s.toggleActive]}
              onPress={() => switchMode('register')}
              activeOpacity={0.8}
            >
              <Text style={[s.toggleTxt, mode === 'register' && s.toggleTxtActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* Card */}
          <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            {mode === 'register' && (
              <>
                <Text style={s.label}>Full Name *</Text>
                <View style={iBox('name', !!nameErr)}>
                  <TextInput
                    style={s.input}
                    placeholder="e.g. Ali Ahmed"
                    placeholderTextColor={C.ph}
                    value={name}
                    onChangeText={t => { setName(t); setNameErr(''); }}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="words"
                  />
                </View>
                {!!nameErr && <Text style={s.err}>⚠ {nameErr}</Text>}
              </>
            )}

            <Text style={s.label}>Email *</Text>
            <View style={iBox('email', !!emailErr)}>
              <TextInput
                style={s.input}
                placeholder="student@university.edu"
                placeholderTextColor={C.ph}
                value={email}
                onChangeText={t => { setEmail(t); setEmailErr(''); }}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {!!emailErr && <Text style={s.err}>⚠ {emailErr}</Text>}

            <Text style={s.label}>Password *</Text>
            <View style={iBox('pass', !!passErr)}>
              <TextInput
                style={s.input}
                placeholder={mode === 'register' ? 'Min 6 characters' : 'Your password'}
                placeholderTextColor={C.ph}
                value={password}
                onChangeText={t => { setPassword(t); setPassErr(''); }}
                onFocus={() => setFocused('pass')}
                onBlur={() => setFocused(null)}
                secureTextEntry
              />
            </View>
            {!!passErr && <Text style={s.err}>⚠ {passErr}</Text>}

            {mode === 'register' && (
              <>
                <Text style={s.label}>Confirm Password *</Text>
                <View style={iBox('confirm', !!confirmErr)}>
                  <TextInput
                    style={s.input}
                    placeholder="Re-enter your password"
                    placeholderTextColor={C.ph}
                    value={confirmPassword}
                    onChangeText={t => { setConfirmPassword(t); setConfirmErr(''); }}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused(null)}
                    secureTextEntry
                  />
                </View>
                {!!confirmErr && <Text style={s.err}>⚠ {confirmErr}</Text>}

                <View style={s.walletNote}>
                  <Text style={{ fontSize: 16, marginRight: 8 }}>🔑</Text>
                  <Text style={s.walletNoteTxt}>
                    An Ethereum wallet will be automatically generated for you to receive CCT tokens.
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.75 }]}
              onPress={mode === 'login' ? handleLogin : handleRegister}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color={C.white} style={{ marginRight: 10 }} />
                  <Text style={s.btnTxt}>
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </Text>
                </View>
              ) : (
                <Text style={s.btnTxt}>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.switchLink}
              onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
              activeOpacity={0.7}
            >
              <Text style={s.switchTxt}>
                {mode === 'login'
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <Text style={s.switchBold}>
                  {mode === 'login' ? 'Register' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={s.footer}>Powered by EcoLedger 🌱</Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 60, paddingBottom: 24 },
  leaf: { fontSize: 52, marginBottom: 10 },
  brand: { fontSize: 36, fontWeight: '900', color: C.dark, letterSpacing: -1 },
  tagline: { fontSize: 14, color: C.green, fontWeight: '500', marginTop: 6 },
  statusWrap: { alignItems: 'center', marginBottom: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
  statusTxt: { fontSize: 12, fontWeight: '500' },
  toggleRow: { flexDirection: 'row', marginHorizontal: 24, marginBottom: 16, backgroundColor: C.white, borderRadius: 14, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  toggleActive: { backgroundColor: C.dark },
  toggleTxt: { fontSize: 15, fontWeight: '600', color: C.grey },
  toggleTxtActive: { color: C.white },
  card: { marginHorizontal: 24, backgroundColor: C.white, borderRadius: 24, padding: 24, shadowColor: C.rose, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6 },
  label: { fontSize: 13, fontWeight: '600', color: C.dark, marginBottom: 8, marginTop: 6 },
  inputBox: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, backgroundColor: '#FAFAFA', marginBottom: 6 },
  inputFocused: { borderColor: C.green, backgroundColor: C.white },
  inputError: { borderColor: C.err, backgroundColor: C.errBg },
  input: { height: 50, paddingHorizontal: 16, fontSize: 15, color: C.txt },
  err: { color: C.err, fontSize: 12, marginBottom: 8, fontWeight: '500' },
  walletNote: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.lightGreen, borderRadius: 12, padding: 12, marginTop: 6, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: C.green },
  walletNoteTxt: { flex: 1, fontSize: 12, color: C.dark, lineHeight: 18 },
  btn: { backgroundColor: C.dark, borderRadius: 12, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16, shadowColor: C.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 },
  btnTxt: { color: C.white, fontSize: 16, fontWeight: '700' },
  switchLink: { alignItems: 'center', marginTop: 16, paddingVertical: 4 },
  switchTxt: { fontSize: 14, color: C.grey },
  switchBold: { color: C.dark, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 12, color: C.grey, marginTop: 28 },
});