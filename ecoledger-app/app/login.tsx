/**
 * Sign in / create account. Split layout on wide screens, a single card on phones.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, font, R, S, shadow } from '@/constants/theme';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Button, Field, IconName, Notice, Segmented, useLayout } from '@/components/ui';

type Mode = 'login' | 'register';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'camera-outline', title: 'Log an eco-action', body: 'Add a photo and a short note about what you did.' },
  { icon: 'shield-checkmark-outline', title: 'Get it verified', body: 'An admin reviews the proof and approves it.' },
  { icon: 'cube-outline', title: 'Earn tokens on-chain', body: 'Approval mints Campus Carbon Tokens to your wallet.' },
];

export default function Login() {
  const { ready, user, health, signIn } = useSession();
  const { isDesktop, isTablet } = useLayout();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  if (ready && user) return <Redirect href={user.role === 'admin' ? '/admin' : '/'} />;

  const validate = () => {
    const e: Record<string, string> = {};
    if (mode === 'register' && name.trim().length < 2) e.name = 'Please enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Please enter a valid email address.';
    if (password.length < (mode === 'register' ? 6 : 1)) e.password = mode === 'register' ? 'Use at least 6 characters.' : 'Please enter your password.';
    if (mode === 'register' && confirm !== password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setFormError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = mode === 'login'
        ? await api.login(email.trim(), password)
        : await api.register(name.trim(), email.trim(), password);
      await signIn(res.token, res.user);
      router.replace(res.user.role === 'admin' ? '/admin' : '/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) setErrors({ email: msg });
      else if (e instanceof ApiError && e.status === 401) setErrors({ password: msg });
      else setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => { setMode(m); setErrors({}); setFormError(''); };
  const offline = health && !health.server;

  const intro = (
    <View style={[s.intro, !isDesktop && s.introCompact]}>
      <View style={s.brandRow}>
        <View style={s.logo}><Ionicons name="leaf" size={isDesktop ? 26 : 22} color="#fff" /></View>
        <Text style={[s.brand, !isDesktop && { fontSize: 30 }]}>EcoLedger</Text>
      </View>
      <Text style={[s.tagline, !isDesktop && { fontSize: 17 }]}>Track. Earn. Sustain.</Text>
      {isDesktop && (
        <>
          <Text style={s.lead}>
            A campus rewards ledger for real environmental work. Every approved action is minted as a
            token, so your record is transparent and can{"'"}t be edited after the fact.
          </Text>
          <View style={{ gap: S.lg, marginTop: S.md }}>
            {POINTS.map((p) => (
              <View key={p.title} style={s.point}>
                <View style={s.pointIcon}><Ionicons name={p.icon} size={20} color={C.green} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pointTitle}>{p.title}</Text>
                  <Text style={s.pointBody}>{p.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const form = (
    <View style={[s.card, { padding: isTablet ? S.xxl : S.xl }]}>
      <View style={{ alignSelf: 'flex-start' }}>
        <Segmented<Mode>
          value={mode}
          onChange={switchMode}
          options={[{ value: 'login', label: 'Sign in' }, { value: 'register', label: 'Create account' }]}
        />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={s.formTitle}>{mode === 'login' ? 'Welcome back' : 'Join EcoLedger'}</Text>
        <Text style={s.formSub}>
          {mode === 'login' ? 'Sign in to log activities and check your tokens.' : 'A wallet address is created for you automatically.'}
        </Text>
      </View>

      {offline ? <Notice tone="red" icon="cloud-offline-outline">The EcoLedger server is not reachable. Start the backend with {'"npm start"'} and try again.</Notice> : null}
      {formError ? <Notice tone="red" icon="alert-circle">{formError}</Notice> : null}

      <View style={{ gap: S.lg }}>
        {mode === 'register' && (
          <Field label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" error={errors.name} />
        )}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@university.edu" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
        <Field label="Password" value={password} onChangeText={setPassword} placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={errors.password} onSubmitEditing={mode === 'login' ? submit : undefined} />
        {mode === 'register' && (
          <Field label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Type it again" secureTextEntry autoComplete="new-password" error={errors.confirm} onSubmitEditing={submit} />
        )}
      </View>

      <Button full label={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={loading} icon={mode === 'login' ? 'log-in-outline' : 'person-add-outline'} />

      <Pressable onPress={() => switchMode(mode === 'login' ? 'register' : 'login')} style={{ alignSelf: 'center' }}>
        <Text style={s.switch}>
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <Text style={{ color: C.roseDeep, fontWeight: '700' }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</Text>
        </Text>
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.blush }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.page, isDesktop && s.pageWide]} keyboardShouldPersistTaps="handled">
        {isDesktop ? (
          <View style={s.split}>
            <View style={{ flex: 1.1 }}>{intro}</View>
            <View style={{ flex: 1, maxWidth: 460 }}>{form}</View>
          </View>
        ) : (
          <View style={{ width: '100%', maxWidth: 460, alignSelf: 'center', gap: S.xl }}>
            {intro}
            {form}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', padding: S.lg, paddingVertical: S.xxxl },
  pageWide: { padding: S.xxxl },
  split: { flexDirection: 'row', alignItems: 'center', gap: 64, width: '100%', maxWidth: 1080, alignSelf: 'center' },

  intro: { gap: S.md },
  introCompact: { alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  logo: { width: 48, height: 48, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: font, fontSize: 44, fontWeight: '800', color: C.green, letterSpacing: -1.2 },
  tagline: { fontFamily: font, fontSize: 22, fontWeight: '700', color: C.roseDeep, letterSpacing: -0.2 },
  lead: { fontFamily: font, fontSize: 17, lineHeight: 26, color: C.text, maxWidth: 480, marginTop: S.sm },
  point: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start', maxWidth: 440 },
  pointIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  pointTitle: { fontFamily: font, fontSize: 16, fontWeight: '700', color: C.ink },
  pointBody: { fontFamily: font, fontSize: 14.5, lineHeight: 21, color: C.text, marginTop: 2 },

  card: { backgroundColor: '#fff', borderRadius: R.xl, gap: S.xl, ...shadow },
  formTitle: { fontFamily: font, fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  formSub: { fontFamily: font, fontSize: 14.5, color: C.muted, lineHeight: 20 },
  switch: { fontFamily: font, fontSize: 14, color: C.muted },
});
