/**
 * Rewards: spend eco points on campus perks. CCT on-chain is never burned; only
 * the spendable points balance goes down.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, font, R, S, shadow } from '@/constants/theme';
import { api, Reward, timeAgo } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { Button, Card, Empty, Grid, IconName, Loading, Notice, PageTitle, Pill, Screen, SectionTitle, t, useLayout } from '@/components/ui';

export default function Rewards() {
  const { user, setUser, toast } = useSession();
  const { cols } = useLayout();
  const rewards = useLoad(() => api.rewards());
  const mine = useLoad(() => api.myRedemptions());
  const [confirm, setConfirm] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const points = user?.ecoPoints ?? 0;

  const redeem = async () => {
    if (!confirm) return;
    setBusy(true);
    setErr('');
    try {
      const res = await api.redeem(confirm._id);
      setUser(res.user);
      toast(res.message, 'good');
      setConfirm(null);
      rewards.reload();
      mine.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not redeem this reward.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen role="student">
      <PageTitle
        title="Rewards"
        subtitle="Spend the eco points you have earned. Your minted CCT stays in your wallet."
        action={<Pill tone="rose" icon="sparkles" label={`${points} points available`} />}
      />
      {rewards.error ? <Notice tone="red" icon="alert-circle">{rewards.error}</Notice> : null}
      {rewards.loading ? <Loading /> : (rewards.data || []).length === 0 ? (
        <Empty icon="gift-outline" title="No rewards yet" body="Rewards added by the admin will show up here." />
      ) : (
        <Grid cols={cols(1, 2, 3)}>
          {(rewards.data || []).map((r) => {
            const enough = points >= r.pointsRequired;
            const out = r.quantity <= 0;
            const pct = Math.min(1, points / r.pointsRequired);
            return (
              <Card key={r._id} style={{ gap: S.md, flex: 1 }}>
                <View style={s.top}>
                  <View style={s.icon}><Ionicons name={(r.icon || 'gift-outline') as IconName} size={22} color={C.rose} /></View>
                  <Pill tone={out ? 'grey' : r.quantity <= 5 ? 'amber' : 'green'} label={out ? 'Out of stock' : `${r.quantity} left`} />
                </View>
                <View style={{ gap: 4, flex: 1 }}>
                  <Text style={t.h3}>{r.title}</Text>
                  {r.description ? <Text style={[t.body, { color: C.muted, fontSize: 14 }]}>{r.description}</Text> : null}
                </View>
                <View style={{ gap: 6 }}>
                  <View style={s.costRow}>
                    <Text style={s.cost}>{r.pointsRequired} pts</Text>
                    {!enough ? <Text style={t.small}>{r.pointsRequired - points} more to go</Text> : null}
                  </View>
                  <View style={s.bar}><View style={[s.barFill, { width: `${pct * 100}%` }]} /></View>
                </View>
                <Button full small={false} kind={enough && !out ? 'primary' : 'ghost'} label={out ? 'Out of stock' : enough ? 'Redeem' : 'Not enough points'} disabled={!enough || out} onPress={() => { setErr(''); setConfirm(r); }} />
              </Card>
            );
          })}
        </Grid>
      )}

      <Card style={{ gap: S.sm }}>
        <SectionTitle>My redemptions</SectionTitle>
        {mine.loading ? <Loading /> : (mine.data || []).length === 0 ? (
          <Text style={[t.body, { color: C.muted, marginTop: S.md }]}>Nothing redeemed yet.</Text>
        ) : (
          <View style={{ marginTop: S.sm }}>
            {(mine.data || []).map((m) => (
              <View key={m._id} style={s.redeemRow}>
                <Ionicons name="checkmark-circle" size={20} color={C.sage} />
                <Text style={[t.h3, { flex: 1, fontSize: 15 }]} numberOfLines={1}>{m.rewardId?.title || 'Reward'}</Text>
                <Text style={t.small}>{m.rewardId ? `${m.rewardId.pointsRequired} pts · ` : ''}{timeAgo(m.redeemedAt)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <Pressable style={s.scrim} onPress={() => !busy && setConfirm(null)}>
          <Pressable style={s.dialog} onPress={() => {}}>
            <View style={[s.icon, { width: 52, height: 52 }]}><Ionicons name="gift" size={24} color={C.rose} /></View>
            <Text style={t.h2}>Redeem {confirm?.title}?</Text>
            <Text style={t.body}>
              This uses {confirm?.pointsRequired} of your {points} eco points. You will have {points - (confirm?.pointsRequired || 0)} left.
            </Text>
            {err ? <Notice tone="red" icon="alert-circle">{err}</Notice> : null}
            <View style={{ flexDirection: 'row', gap: S.sm, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button kind="ghost" label="Cancel" onPress={() => setConfirm(null)} disabled={busy} />
              <Button label="Confirm" icon="checkmark" onPress={redeem} loading={busy} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.roseTint, alignItems: 'center', justifyContent: 'center' },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cost: { fontFamily: font, fontSize: 20, fontWeight: '800', color: C.green },
  bar: { height: 6, borderRadius: 3, backgroundColor: C.roseTint, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.rose, borderRadius: 3 },
  redeemRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, borderBottomWidth: 1, borderBottomColor: C.line },
  scrim: { flex: 1, backgroundColor: 'rgba(27,43,36,0.4)', alignItems: 'center', justifyContent: 'center', padding: S.lg },
  dialog: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: R.xl, padding: S.xl, gap: S.lg, ...shadow },
});
