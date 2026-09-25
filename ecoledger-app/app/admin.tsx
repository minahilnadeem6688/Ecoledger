/**
 * Admin review queue. Approving an activity credits the points and mints the same
 * number of CCT on-chain; the result (tx hash or the reason it failed) is shown
 * right away, and failed mints can be retried once the chain is back.
 */
import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S } from '@/constants/theme';
import { api, Activity, shortHash, Status, uploadUrl } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { ActivityRow } from '@/components/activity';
import { Button, Card, Empty, Field, Grid, Loading, Notice, PageTitle, Screen, Segmented, Stat, t, useLayout } from '@/components/ui';

type Filter = Status | 'all';

export default function Admin() {
  const { health, toast, refreshHealth } = useSession();
  const { isTablet, cols } = useLayout();
  const [filter, setFilter] = useState<Filter>('pending');
  const { data, setData, loading, error, reload } = useLoad(() => api.allActivities());
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const list = data || [];
  const count = (f: Filter) => (f === 'all' ? list.length : list.filter((a) => a.verificationStatus === f).length);
  const shown = filter === 'all' ? list : list.filter((a) => a.verificationStatus === filter);
  const failedMints = list.filter((a) => a.verificationStatus === 'approved' && a.mintStatus !== 'minted').length;
  const chainLive = !!health?.chain.contract;

  const replace = (a: Activity) => setData(list.map((x) => (x._id === a._id ? a : x)));

  const approve = async (a: Activity) => {
    setBusy(a._id);
    try {
      const res = await api.verify(a._id, 'approved');
      replace(res.activity);
      if (res.mint?.ok) toast(`Approved. ${res.activity.pointsEarned} CCT minted in tx ${shortHash(res.mint.txHash)}.`, 'good');
      else toast(`Approved and points added, but minting failed: ${res.mint?.reason || 'unknown reason'}`, 'bad');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not approve.', 'bad');
      reload();
    } finally {
      setBusy(null);
      refreshHealth();
    }
  };

  const reject = async (a: Activity) => {
    setBusy(a._id);
    try {
      const res = await api.verify(a._id, 'rejected', reason.trim() || undefined);
      replace(res.activity);
      toast('Activity rejected.', 'info');
      setRejecting(null);
      setReason('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not reject.', 'bad');
      reload();
    } finally {
      setBusy(null);
    }
  };

  const retry = async (a: Activity) => {
    setBusy(a._id);
    try {
      const res = await api.retryMint(a._id);
      replace(res.activity);
      if (res.mint.ok) toast(`Minted ${res.activity.pointsEarned} CCT in tx ${shortHash(res.mint.txHash)}.`, 'good');
      else toast(`Mint failed again: ${res.mint.reason}`, 'bad');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not retry.', 'bad');
    } finally {
      setBusy(null);
      refreshHealth();
    }
  };

  const actions = (a: Activity) => {
    if (a.verificationStatus === 'pending') {
      if (rejecting === a._id) {
        return (
          <View style={{ gap: S.sm, marginTop: S.xs }}>
            <Field label="Reason (shown to the student)" value={reason} onChangeText={setReason} placeholder="e.g. Photo does not show the activity" />
            <View style={s.btnRow}>
              <Button small kind="danger" icon="close" label="Confirm rejection" onPress={() => reject(a)} loading={busy === a._id} />
              <Button small kind="ghost" label="Cancel" onPress={() => { setRejecting(null); setReason(''); }} />
            </View>
          </View>
        );
      }
      return (
        <View style={[s.btnRow, { marginTop: S.xs }]}>
          <Button small icon="checkmark" label={chainLive ? `Approve & mint ${a.pointsEarned} CCT` : 'Approve'} onPress={() => approve(a)} loading={busy === a._id} disabled={!!busy && busy !== a._id} />
          <Button small kind="danger" icon="close" label="Reject" onPress={() => { setRejecting(a._id); setReason(''); }} disabled={!!busy} />
        </View>
      );
    }
    if (a.verificationStatus === 'approved' && a.mintStatus !== 'minted') {
      return (
        <View style={{ gap: S.sm, marginTop: S.xs }}>
          {a.mintError ? <Text style={[t.small, { color: C.amber }]}>Last attempt: {a.mintError}</Text> : null}
          <View style={s.btnRow}>
            <Button small kind="secondary" icon="refresh" label="Retry mint" onPress={() => retry(a)} loading={busy === a._id} disabled={!chainLive} />
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <Screen role="admin">
      <PageTitle title="Review activities" subtitle="Check the proof, then approve to mint tokens or reject with a reason." action={<Button small kind="ghost" icon="refresh" label="Refresh" onPress={() => { reload(); refreshHealth(); }} />} />

      {!chainLive && health ? (
        <Notice tone="amber" icon="warning">
          Blockchain unavailable: {health.chain.reason || 'unknown'} Approvals still add points, and you can retry the mint later.
        </Notice>
      ) : null}
      {error ? <Notice tone="red" icon="alert-circle">{error}</Notice> : null}

      <Grid cols={cols(2, 4, 4)}>
        <Stat label="Waiting for review" value={count('pending')} icon="time" tone="amber" />
        <Stat label="Approved" value={count('approved')} icon="checkmark-done" tone="green" />
        <Stat label="Rejected" value={count('rejected')} icon="close-circle" tone="rose" />
        <Stat label="Mints to retry" value={failedMints} icon="cube" tone="sage" />
      </Grid>

      <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => ({
            value: f,
            label: `${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)} (${count(f)})`,
          }))}
        />
      </View>

      {loading ? <Loading /> : shown.length === 0 ? (
        <Empty icon="checkmark-done-outline" title={filter === 'pending' ? 'All caught up' : 'Nothing here'} body={filter === 'pending' ? 'No activities are waiting for review.' : 'No activities match this filter.'} />
      ) : (
        <View style={{ gap: S.lg }}>
          {shown.map((a) => {
            const img = uploadUrl(a.proofImage);
            return (
              <Card key={a._id} padded={false} style={{ overflow: 'hidden' }}>
                <View style={{ flexDirection: isTablet ? 'row' : 'column' }}>
                  <Pressable
                    onPress={() => img && setPhoto(img)}
                    disabled={!img}
                    style={[s.thumb, isTablet ? { width: 220, alignSelf: 'stretch', minHeight: 180 } : { height: 190 }]}
                    accessibilityLabel="View proof photo"
                  >
                    {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
                      <View style={s.noImg}><Ionicons name="image-outline" size={26} color={C.pink} /><Text style={t.small}>No photo</Text></View>
                    )}
                    {img ? <View style={s.zoom}><Ionicons name="expand" size={14} color="#fff" /></View> : null}
                  </Pressable>
                  <View style={{ flex: 1, paddingHorizontal: S.xl, paddingBottom: S.md }}>
                    <ActivityRow a={a} showStudent last right={actions(a)} />
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      )}

      <Modal visible={!!photo} transparent animationType="fade" onRequestClose={() => setPhoto(null)}>
        <Pressable style={s.viewer} onPress={() => setPhoto(null)}>
          {photo ? <Image source={{ uri: photo }} style={s.viewerImg} resizeMode="contain" /> : null}
          <View style={s.viewerClose}><Ionicons name="close" size={22} color="#fff" /></View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  btnRow: { flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' },
  thumb: { backgroundColor: C.blush, overflow: 'hidden' },
  noImg: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  zoom: { position: 'absolute', right: 10, bottom: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(27,43,36,0.55)', alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: 'rgba(15,20,18,0.88)', alignItems: 'center', justifyContent: 'center', padding: S.xl },
  viewerImg: { width: '100%', height: '100%', maxWidth: 1000, borderRadius: R.md },
  viewerClose: { position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
