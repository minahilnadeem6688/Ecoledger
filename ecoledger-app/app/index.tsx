/**
 * Student home: balances, what's waiting for review, and recent activity.
 */
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '@/constants/theme';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { ActivityRow } from '@/components/activity';
import { Button, Card, Empty, Grid, IconName, Loading, Notice, PageTitle, Screen, SectionTitle, Stat, t, useLayout } from '@/components/ui';

const ACTIONS: { label: string; body: string; href: string; icon: IconName }[] = [
  { label: 'Log an activity', body: 'Photo, note and location', href: '/submit-activity', icon: 'add-circle-outline' },
  { label: 'Open wallet', body: 'On-chain CCT and receipts', href: '/wallet', icon: 'wallet-outline' },
  { label: 'Browse rewards', body: 'Spend your eco points', href: '/rewards', icon: 'gift-outline' },
  { label: 'Leaderboard', body: 'See who is leading', href: '/leaderboard', icon: 'trophy-outline' },
];

export default function Home() {
  const { user, queued, health, refreshUser } = useSession();
  const router = useRouter();
  const { isDesktop, cols } = useLayout();
  const { data, loading, error, reload } = useLoad(async () => {
    refreshUser();
    return api.myActivities();
  });
  // reload once the server is back (saved activities are sent at that moment too)
  useEffect(() => { if (health?.server && queued === 0) reload(); }, [health?.server, queued, reload]);

  const list = data || [];
  const pending = list.filter((a) => a.verificationStatus === 'pending').length;
  const approved = list.filter((a) => a.verificationStatus === 'approved').length;
  const firstName = user?.name.split(' ')[0] || '';

  const recent = (
    <Card>
      <SectionTitle right={list.length ? <Button small kind="ghost" label="View all" onPress={() => router.push('/activities')} /> : null}>
        Recent activity
      </SectionTitle>
      {loading ? <Loading /> : error && !data ? (
        <Text style={[t.body, { color: C.muted, marginTop: S.md }]}>Your activities will show here once the server is reachable again.</Text>
      ) : list.length === 0 ? (
        <View>
          <Empty
            bare
            icon="leaf-outline"
            title="Nothing logged yet"
            body="Plant a tree, join a clean-up or recycle, then log it here with a photo. Approved actions mint tokens to your wallet."
            action={<Button label="Log your first activity" icon="add" onPress={() => router.push('/submit-activity')} />}
          />
        </View>
      ) : (
        <View style={{ marginTop: S.sm }}>
          {list.slice(0, 5).map((a, i, arr) => <ActivityRow key={a._id} a={a} last={i === arr.length - 1} />)}
        </View>
      )}
    </Card>
  );

  const quick = (
    <Card style={{ gap: S.sm }}>
      <SectionTitle>Quick actions</SectionTitle>
      <View style={{ marginTop: S.md, gap: S.sm }}>
        {ACTIONS.map((a) => (
          <Pressable key={a.href} onPress={() => router.push(a.href as any)} style={({ hovered }: any) => [s.action, hovered && { backgroundColor: C.roseTint }]}>
            <View style={s.actionIcon}><Ionicons name={a.icon} size={20} color={C.rose} /></View>
            <View style={{ flex: 1 }}>
              <Text style={t.h3}>{a.label}</Text>
              <Text style={t.small}>{a.body}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.muted} />
          </Pressable>
        ))}
      </View>
    </Card>
  );

  return (
    <Screen role="student">
      <PageTitle
        title={`Hi, ${firstName}`}
        subtitle="Here is where your eco-actions stand."
        action={<Button label="Log activity" icon="add" onPress={() => router.push('/submit-activity')} />}
      />

      {queued > 0 ? (
        <Notice tone="amber" icon="cloud-upload-outline">
          {queued} {queued === 1 ? 'activity is' : 'activities are'} saved on this device and will be sent as soon as the server is reachable.
        </Notice>
      ) : null}
      {error ? <Notice tone="red" icon="alert-circle">{error}</Notice> : null}

      <Grid cols={cols(2, 4, 4)} gap={S.lg}>
        <Stat label="Eco points to spend" value={user?.ecoPoints ?? 0} icon="sparkles" tone="rose" />
        <Stat label="CCT tokens earned" value={user?.cctTokens ?? 0} icon="cube" tone="green" />
        <Stat label="Approved actions" value={approved} icon="checkmark-done" tone="sage" />
        <Stat label="Waiting for review" value={pending} icon="time" tone="amber" />
      </Grid>

      {isDesktop ? (
        <View style={{ flexDirection: 'row', gap: S.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.7 }}>{recent}</View>
          <View style={{ flex: 1 }}>{quick}</View>
        </View>
      ) : (
        <>
          {recent}
          {quick}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  action: { flexDirection: 'row', alignItems: 'center', gap: S.md, padding: S.md, borderRadius: R.md, borderWidth: 1, borderColor: C.line },
  actionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.roseTint, alignItems: 'center', justifyContent: 'center' },
});
