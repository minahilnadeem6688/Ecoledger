/**
 * One activity in a list: icon, type, note, status and (once approved) the mint receipt.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, font, S } from '@/constants/theme';
import { Activity, shortHash, timeAgo } from '@/lib/api';
import { IconName, Mono, Pill, StatusPill } from './ui';

export function MintLine({ a }: { a: Activity }) {
  if (a.verificationStatus !== 'approved') return null;
  if (a.mintStatus === 'minted') {
    return (
      <View style={s.mint}>
        <Ionicons name="cube" size={14} color={C.green} />
        <Text style={s.mintText}>{a.pointsEarned} CCT minted</Text>
        <Mono style={{ color: C.muted, fontSize: 12 }}>tx {shortHash(a.mintTxHash, 8, 6)}</Mono>
        {a.mintBlock != null ? <Mono style={{ color: C.muted, fontSize: 12 }}>block {a.mintBlock}</Mono> : null}
      </View>
    );
  }
  return (
    <View style={s.mint}>
      <Ionicons name="alert-circle" size={14} color={C.amber} />
      <Text style={[s.mintText, { color: C.amber }]}>Points added, token mint pending</Text>
    </View>
  );
}

export function ActivityRow({ a, showStudent, right, last }: { a: Activity; showStudent?: boolean; right?: React.ReactNode; last?: boolean }) {
  const icon = (a.activityType?.icon || 'leaf-outline') as IconName;
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <View style={s.icon}><Ionicons name={icon} size={20} color={C.green} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={s.top}>
          <Text style={s.title} numberOfLines={1}>{a.activityType?.name || 'Activity'}</Text>
          <StatusPill status={a.verificationStatus} />
        </View>
        {showStudent && a.studentId ? <Text style={s.meta}>{a.studentId.name} · {a.studentId.email}</Text> : null}
        {a.description ? <Text style={s.desc} numberOfLines={3}>{a.description}</Text> : null}
        <View style={s.metaRow}>
          <Pill tone="rose" icon="sparkles" label={`${a.pointsEarned} pts`} />
          {a.location ? <Text style={s.meta} numberOfLines={1}><Ionicons name="location-outline" size={12} /> {a.location}</Text> : null}
          <Text style={s.meta}>{timeAgo(a.createdAt)}</Text>
        </View>
        {a.verificationStatus === 'rejected' && a.rejectionReason ? (
          <Text style={[s.meta, { color: C.red }]}>Reason: {a.rejectionReason}</Text>
        ) : null}
        <MintLine a={a} />
        {right}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: S.md, paddingVertical: S.lg, borderBottomWidth: 1, borderBottomColor: C.line },
  icon: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.greenTint, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm, flexWrap: 'wrap' },
  title: { fontFamily: font, fontSize: 16, fontWeight: '700', color: C.ink, flexShrink: 1 },
  desc: { fontFamily: font, fontSize: 14.5, lineHeight: 21, color: C.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: S.md, flexWrap: 'wrap' },
  meta: { fontFamily: font, fontSize: 13, color: C.muted },
  mint: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  mintText: { fontFamily: font, fontSize: 13, fontWeight: '700', color: C.green },
});
