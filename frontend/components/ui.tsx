/**
 * EcoLedger UI kit. Every screen is built from these pieces so spacing, type and
 * behaviour stay consistent from a 360px phone to a wide desktop window.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TextInputProps, useWindowDimensions, View, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BP, C, font, mono, R, S, shadow } from '@/constants/theme';
import { useSession } from '@/lib/session';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ─── Layout ────────────────────────────────────────────────────────────── */

export function useLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BP.desktop;
  const isTablet = width >= BP.tablet;
  return {
    width,
    isDesktop,
    isTablet,
    isPhone: !isTablet,
    gutter: isDesktop ? S.xxl : isTablet ? S.xl : S.lg,
    /** how many columns a card grid should use */
    cols: (phone: number, tablet: number, desktop: number) => (isDesktop ? desktop : isTablet ? tablet : phone),
  };
}

/** A responsive grid made of flex rows, so it works the same on web and native. */
export function Grid({ cols, gap = S.lg, children }: { cols: number; gap?: number; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap }}>
          {row.map((child, c) => <View key={c} style={{ flex: 1, minWidth: 0 }}>{child}</View>)}
          {Array.from({ length: cols - row.length }).map((_, k) => <View key={`pad${k}`} style={{ flex: 1 }} />)}
        </View>
      ))}
    </View>
  );
}

const NAV: { label: string; href: string; icon: IconName; admin?: boolean; student?: boolean }[] = [
  { label: 'Home', href: '/', icon: 'home-outline', student: true },
  { label: 'Submit', href: '/submit-activity', icon: 'add-circle-outline', student: true },
  { label: 'Activities', href: '/activities', icon: 'list-outline', student: true },
  { label: 'Wallet', href: '/wallet', icon: 'wallet-outline', student: true },
  { label: 'Rewards', href: '/rewards', icon: 'gift-outline', student: true },
  { label: 'Leaderboard', href: '/leaderboard', icon: 'trophy-outline' },
  { label: 'Review', href: '/admin', icon: 'shield-checkmark-outline', admin: true },
];

function StatusDot() {
  const { health } = useSession();
  const ok = health?.server && health.database && health.chain.contract;
  const label = !health ? 'Checking…' : !health.server ? 'Server offline' : !health.database ? 'Database offline' : !health.chain.contract ? 'Chain offline' : 'Chain live';
  return (
    <View style={[st.status, { backgroundColor: ok ? C.greenTint : C.amberTint }]} accessibilityLabel={`Status: ${label}`}>
      <View style={[st.statusDot, { backgroundColor: ok ? C.green : C.amber }]} />
      <Text style={[st.statusText, { color: ok ? C.greenDeep : C.amber }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Header() {
  const { user, signOut } = useSession();
  const { isDesktop, gutter } = useLayout();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const links = NAV.filter((n) => (user?.role === 'admin' ? !n.student : !n.admin));
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  const go = (href: string) => { setOpen(false); router.push(href as any); };

  return (
    <View style={st.headerWrap}>
      <View style={[st.header, { paddingHorizontal: gutter }]}>
        <Pressable onPress={() => go(user?.role === 'admin' ? '/admin' : '/')} style={st.brand} accessibilityRole="link">
          <View style={st.logoMark}><Ionicons name="leaf" size={16} color="#fff" /></View>
          <Text style={st.brandText}>EcoLedger</Text>
        </Pressable>

        {isDesktop && (
          <View style={st.navRow}>
            {links.map((n) => (
              <Pressable key={n.href} onPress={() => go(n.href)} style={[st.navLink, active(n.href) && st.navLinkOn]} accessibilityRole="link">
                <Text style={[st.navText, active(n.href) && st.navTextOn]}>{n.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={st.headerRight}>
          <StatusDot />
          {isDesktop ? (
            <Pressable onPress={async () => { await signOut(); router.replace('/login'); }} style={st.iconBtn} accessibilityLabel="Sign out">
              <Ionicons name="log-out-outline" size={20} color={C.green} />
            </Pressable>
          ) : (
            <Pressable onPress={() => setOpen(true)} style={st.iconBtn} accessibilityLabel="Open menu">
              <Ionicons name="menu" size={22} color={C.green} />
            </Pressable>
          )}
        </View>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.scrim} onPress={() => setOpen(false)}>
          <Pressable style={st.sheet} onPress={() => {}}>
            <View style={st.sheetHead}>
              <View>
                <Text style={st.sheetName}>{user?.name}</Text>
                <Text style={st.sheetMail}>{user?.email}</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={st.iconBtn} accessibilityLabel="Close menu">
                <Ionicons name="close" size={22} color={C.green} />
              </Pressable>
            </View>
            {links.map((n) => (
              <Pressable key={n.href} onPress={() => go(n.href)} style={[st.sheetLink, active(n.href) && st.sheetLinkOn]}>
                <Ionicons name={n.icon} size={20} color={active(n.href) ? C.green : C.muted} />
                <Text style={[st.sheetText, active(n.href) && { color: C.green }]}>{n.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={async () => { setOpen(false); await signOut(); router.replace('/login'); }} style={[st.sheetLink, { marginTop: S.sm }]}>
              <Ionicons name="log-out-outline" size={20} color={C.roseDeep} />
              <Text style={[st.sheetText, { color: C.roseDeep }]}>Sign out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Toast() {
  const { toastState } = useSession();
  const y = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(toastState);
  useEffect(() => {
    if (!toastState) return;
    setShown(toastState);
    Animated.timing(y, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
    const t = setTimeout(() => Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start(), 3600);
    return () => clearTimeout(t);
  }, [toastState, y]);
  if (!shown) return null;
  const bg = shown.tone === 'good' ? C.green : shown.tone === 'bad' ? C.red : C.ink;
  return (
    <Animated.View pointerEvents="none" style={[st.toast, { backgroundColor: bg, opacity: y, transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      <Text style={st.toastText}>{shown.message}</Text>
    </Animated.View>
  );
}

/**
 * Page frame: header, centred content column, footer and toasts.
 * Pass `role` to keep students out of admin pages and the other way round.
 */
export function Screen({
  children, role, maxWidth = 1120, onRefresh,
}: { children: React.ReactNode; role?: 'student' | 'admin' | 'any'; maxWidth?: number; onRefresh?: () => void }) {
  const { ready, user } = useSession();
  const { gutter } = useLayout();
  if (!ready) return <View style={[st.root, st.center]}><ActivityIndicator color={C.green} /></View>;
  if (!user) return <Redirect href="/login" />;
  if (role === 'admin' && user.role !== 'admin') return <Redirect href="/" />;
  if (role === 'student' && user.role === 'admin') return <Redirect href="/admin" />;
  return (
    <SafeAreaView style={st.root} edges={['top']}>
      <Header />
      <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }} keyboardShouldPersistTaps="handled">
        <View style={[st.content, { maxWidth, paddingHorizontal: gutter }]}>{children}</View>
        <Text style={st.footer}>EcoLedger · verified eco-actions, rewarded with Campus Carbon Tokens</Text>
      </ScrollView>
      <Toast />
      {onRefresh ? null : null}
    </SafeAreaView>
  );
}

/* ─── Building blocks ───────────────────────────────────────────────────── */

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const { isTablet } = useLayout();
  return (
    <View style={[st.pageTitle, !isTablet && { flexDirection: 'column', alignItems: 'flex-start' }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[st.h1, !isTablet && { fontSize: 26 }]} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={st.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[]; padded?: boolean }) {
  return <View style={[st.card, padded && { padding: S.xl }, style as any]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={st.sectionRow}>
      <Text style={st.h2}>{children}</Text>
      {right}
    </View>
  );
}

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'danger' | 'rose';
export function Button({
  label, onPress, kind = 'primary', icon, loading, disabled, small, full,
}: { label: string; onPress?: () => void; kind?: BtnKind; icon?: IconName; loading?: boolean; disabled?: boolean; small?: boolean; full?: boolean }) {
  const colors: Record<BtnKind, { bg: string; fg: string; border: string }> = {
    primary: { bg: C.green, fg: '#fff', border: C.green },
    secondary: { bg: C.sage, fg: '#fff', border: C.sage },
    rose: { bg: C.rose, fg: '#fff', border: C.rose },
    ghost: { bg: 'transparent', fg: C.green, border: C.lineStrong },
    danger: { bg: 'transparent', fg: C.red, border: '#EBC0B4' },
  };
  const c = colors[kind];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed, hovered }: any) => [
        st.btn, small && st.btnSmall, full && { alignSelf: 'stretch' },
        { backgroundColor: c.bg, borderColor: c.border, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        hovered && !off && kind !== 'ghost' && kind !== 'danger' && { transform: [{ translateY: -1 }] },
        hovered && !off && (kind === 'ghost' || kind === 'danger') && { backgroundColor: kind === 'danger' ? C.redTint : C.greenTint },
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={c.fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={c.fg} /> : null}
      <Text style={[st.btnText, small && { fontSize: 14 }, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#A69BA0"
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[st.input, props.multiline && { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }, focus && st.inputFocus, !!error && { borderColor: C.red }, props.style as any]}
      />
      {error ? <Text style={st.error}>{error}</Text> : hint ? <Text style={st.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Pill({ tone, label, icon }: { tone: 'green' | 'amber' | 'red' | 'rose' | 'grey'; label: string; icon?: IconName }) {
  const map = {
    green: [C.greenTint, C.greenDeep], amber: [C.amberTint, C.amber], red: [C.redTint, C.red],
    rose: [C.roseTint, C.roseDeep], grey: ['#F1EEEF', C.muted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[st.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Text style={[st.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  if (status === 'approved') return <Pill tone="green" icon="checkmark-circle" label="Approved" />;
  if (status === 'rejected') return <Pill tone="red" icon="close-circle" label="Rejected" />;
  return <Pill tone="amber" icon="time" label="Pending review" />;
}

export function Stat({ label, value, icon, tone = 'green', note, row }: { label: string; value: string | number; icon: IconName; tone?: 'green' | 'rose' | 'sage' | 'amber'; note?: string; row?: boolean }) {
  const color = { green: C.green, rose: C.rose, sage: C.sage, amber: C.amber }[tone];
  const bg = { green: C.greenTint, rose: C.roseTint, sage: '#EDF4EE', amber: C.amberTint }[tone];
  return (
    <Card style={[{ gap: S.md }, row ? { flexDirection: 'row', alignItems: 'center', padding: S.lg } : {}]}>
      <View style={[st.statIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={20} color={color} /></View>
      <View style={{ gap: 2, flex: row ? 1 : undefined }}>
        <Text style={st.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text style={st.statLabel}>{label}</Text>
        {note ? <Text style={st.hint}>{note}</Text> : null}
      </View>
    </Card>
  );
}

export function Empty({ icon, title, body, action, bare }: { icon: IconName; title: string; body?: string; action?: React.ReactNode; bare?: boolean }) {
  return (
    <Card style={[{ alignItems: 'center', gap: S.md, paddingVertical: S.xxxl }, bare ? { borderWidth: 0, boxShadow: 'none', shadowOpacity: 0, elevation: 0, paddingVertical: S.xl } as any : {}]}>
      <View style={[st.statIcon, { width: 56, height: 56, backgroundColor: C.roseTint }]}><Ionicons name={icon} size={26} color={C.rose} /></View>
      <Text style={[st.h3, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[st.body, { textAlign: 'center', maxWidth: 380 }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: S.xs }}>{action}</View> : null}
    </Card>
  );
}

export function Notice({ tone = 'amber', icon = 'information-circle', children }: { tone?: 'amber' | 'green' | 'red' | 'rose'; icon?: IconName; children: React.ReactNode }) {
  const [bg, fg] = { amber: [C.amberTint, C.amber], green: [C.greenTint, C.greenDeep], red: [C.redTint, C.red], rose: [C.roseTint, C.roseDeep] }[tone];
  return (
    <View style={[st.notice, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={fg} style={{ marginTop: 1 }} />
      <Text style={[st.noticeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.segment}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[st.segBtn, value === o.value && st.segBtnOn]} accessibilityRole="tab" accessibilityState={{ selected: value === o.value }}>
          <Text style={[st.segText, value === o.value && st.segTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Mono({ children, style, numberOfLines }: { children: React.ReactNode; style?: any; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[{ fontFamily: mono, fontSize: 13, color: C.text }, style]}>{children}</Text>;
}

export function Loading() {
  return <View style={{ paddingVertical: S.xxxl, alignItems: 'center' }}><ActivityIndicator color={C.green} /></View>;
}

/* ─── Styles ────────────────────────────────────────────────────────────── */

export const t = StyleSheet.create({
  h1: { fontFamily: font, fontSize: 32, fontWeight: '800', color: C.ink, letterSpacing: -0.6 },
  h2: { fontFamily: font, fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  h3: { fontFamily: font, fontSize: 17, fontWeight: '700', color: C.ink },
  body: { fontFamily: font, fontSize: 15, lineHeight: 22, color: C.text },
  small: { fontFamily: font, fontSize: 13, color: C.muted },
});

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', alignSelf: 'center', paddingTop: S.xl, gap: S.xl },
  footer: { fontFamily: font, fontSize: 12, color: C.muted, textAlign: 'center', marginTop: S.xxxl, paddingHorizontal: S.lg },

  headerWrap: { backgroundColor: 'rgba(255,255,255,0.92)', borderBottomWidth: 1, borderBottomColor: C.line, zIndex: 10 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', gap: S.lg, width: '100%', maxWidth: 1180, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  logoMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: font, fontSize: 19, fontWeight: '800', color: C.green, letterSpacing: -0.4 },
  navRow: { flexDirection: 'row', gap: 2, flex: 1, justifyContent: 'center' },
  navLink: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill },
  navLinkOn: { backgroundColor: C.greenTint },
  navText: { fontFamily: font, fontSize: 14, fontWeight: '600', color: C.muted },
  navTextOn: { color: C.green },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginLeft: 'auto' },
  iconBtn: { width: 40, height: 40, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, maxWidth: 170 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: font, fontSize: 12, fontWeight: '700' },

  scrim: { flex: 1, backgroundColor: 'rgba(27,43,36,0.35)', alignItems: 'flex-end' },
  sheet: { width: 300, maxWidth: '86%', height: '100%', backgroundColor: '#fff', padding: S.xl, gap: 4 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: S.lg, paddingBottom: S.lg, borderBottomWidth: 1, borderBottomColor: C.line },
  sheetName: { fontFamily: font, fontSize: 17, fontWeight: '800', color: C.ink },
  sheetMail: { fontFamily: font, fontSize: 13, color: C.muted, marginTop: 2 },
  sheetLink: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: 12, paddingHorizontal: S.md, borderRadius: R.md },
  sheetLinkOn: { backgroundColor: C.greenTint },
  sheetText: { fontFamily: font, fontSize: 16, fontWeight: '600', color: C.text },

  toast: { position: 'absolute', bottom: 28, alignSelf: 'center', maxWidth: '90%', paddingHorizontal: 18, paddingVertical: 12, borderRadius: R.pill, ...shadow },
  toastText: { fontFamily: font, fontSize: 14, fontWeight: '600', color: '#fff', textAlign: 'center' },

  pageTitle: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: S.lg },
  h1: t.h1 as any,
  h2: t.h2 as any,
  h3: t.h3 as any,
  body: t.body as any,
  subtitle: { fontFamily: font, fontSize: 16, color: C.muted, lineHeight: 22 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.md, marginBottom: -S.sm },

  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, ...shadow },

  btn: { minHeight: 48, paddingHorizontal: 20, borderRadius: R.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start' },
  btnSmall: { minHeight: 38, paddingHorizontal: 14, borderRadius: R.sm },
  btnText: { fontFamily: font, fontSize: 15, fontWeight: '700' },

  label: { fontFamily: font, fontSize: 13, fontWeight: '700', color: C.green, letterSpacing: 0.2 },
  input: { fontFamily: font, fontSize: 16, color: C.ink, backgroundColor: '#FFFBFC', borderWidth: 1.5, borderColor: C.line, borderRadius: R.md, paddingHorizontal: 14, minHeight: 50 },
  inputFocus: { borderColor: C.sage, backgroundColor: '#fff' },
  hint: { fontFamily: font, fontSize: 12.5, color: C.muted },
  error: { fontFamily: font, fontSize: 13, color: C.red, fontWeight: '600' },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, alignSelf: 'flex-start' },
  pillText: { fontFamily: font, fontSize: 12.5, fontWeight: '700' },

  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: font, fontSize: 28, fontWeight: '800', color: C.ink, letterSpacing: -0.6 },
  statLabel: { fontFamily: font, fontSize: 13.5, fontWeight: '600', color: C.muted },

  notice: { flexDirection: 'row', gap: S.sm, padding: S.md, borderRadius: R.md, alignItems: 'flex-start' },
  noticeText: { fontFamily: font, fontSize: 14, lineHeight: 20, flex: 1, fontWeight: '500' },

  segment: { flexDirection: 'row', gap: 6, padding: 4, backgroundColor: '#fff', borderRadius: R.pill, borderWidth: 1, borderColor: C.line },
  segBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill },
  segBtnOn: { backgroundColor: C.green },
  segText: { fontFamily: font, fontSize: 14, fontWeight: '700', color: C.muted },
  segTextOn: { color: '#fff' },
});
