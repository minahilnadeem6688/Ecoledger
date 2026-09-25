/**
 * Wallet: the student's address, the live on-chain CCT balance read from the
 * contract, and a receipt for every mint.
 */
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { C, font, mono, R, S } from '@/constants/theme';
import { api, explorerLink, shortHash, timeAgo } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { Button, Card, Empty, Field, Grid, Loading, Mono, Notice, PageTitle, Pill, Screen, SectionTitle, Stat, t, useLayout } from '@/components/ui';

export default function Wallet() {
  const { toast, setUser } = useSession();
  const { isTablet, isDesktop, isPhone, cols } = useLayout();
  const { data: w, loading, error, reload } = useLoad(() => api.wallet());
  const [editing, setEditing] = useState(false);
  const [addr, setAddr] = useState('');
  const [addrError, setAddrError] = useState('');
  const [saving, setSaving] = useState(false);

  const copy = async (value: string, what: string) => {
    await Clipboard.setStringAsync(value);
    toast(`${what} copied.`, 'good');
  };

  const connect = async () => {
    setAddrError('');
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr.trim())) { setAddrError('Wallet address must start with 0x and be 42 characters long.'); return; }
    setSaving(true);
    try {
      setUser(await api.connectWallet(addr.trim()));
      toast('Wallet connected. New tokens will be minted to this address.', 'good');
      setEditing(false);
      setAddr('');
      reload();
    } catch (e) {
      setAddrError(e instanceof Error ? e.message : 'Could not save the address.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Screen role="student"><PageTitle title="Wallet" /><Loading /></Screen>;

  const chainLive = !!w?.chain.contract;
  const mismatch = w && w.chain.network !== 'public' && w.onChainBalance != null && w.onChainBalance < w.recordedTokens;
  const open = (url: string | null) => { if (url) Linking.openURL(url); };

  const hero = w ? (
    <View style={[s.hero, { padding: isTablet ? S.xxl : S.xl }]}>
      <View style={s.heroTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
          <Ionicons name="wallet" size={18} color={C.blush} />
          <Text style={s.heroLabel}>Campus Carbon Token balance</Text>
        </View>
        <Pill tone={chainLive ? 'green' : 'amber'} icon={chainLive ? 'radio-button-on' : 'warning'} label={chainLive ? 'Read live from chain' : 'Chain offline'} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.sm }}>
        <Text style={[s.heroValue, !isTablet && { fontSize: 44 }]}>{w.onChainBalance ?? '–'}</Text>
        <Text style={s.heroUnit}>CCT</Text>
      </View>
      <Pressable onPress={() => copy(w.walletAddress, 'Wallet address')} style={s.addr} accessibilityLabel="Copy wallet address">
        <Text style={s.addrText} numberOfLines={1}>{isDesktop ? w.walletAddress : shortHash(w.walletAddress, 10, 8)}</Text>
        <Ionicons name="copy-outline" size={16} color={C.blush} />
      </Pressable>
    </View>
  ) : null;

  const chain = w ? (
    <Card style={{ gap: S.md }}>
      <SectionTitle>Network</SectionTitle>
      <View style={{ gap: S.sm, marginTop: S.sm }}>
        <Row label="Status" value={chainLive ? 'Connected' : 'Unavailable'} />
        <Row label="Token" value={w.chain.symbol ? `${w.chain.symbol} (ERC-20, whole tokens)` : 'CCT'} />
        <Row label="Chain ID" value={w.chain.chainId ? String(w.chain.chainId) : '–'} />
        <Row label="Contract" value={w.chain.address ? shortHash(w.chain.address, 8, 6) : 'Not deployed'} mono onCopy={w.chain.address ? () => copy(w.chain.address!, 'Contract address') : undefined} />
        {explorerLink(w.chain, 'address', w.walletAddress) ? (
          <Button small kind="ghost" icon="open-outline" label="View my wallet on the block explorer" onPress={() => open(explorerLink(w.chain, 'address', w.walletAddress))} />
        ) : null}
      </View>
      {!chainLive && w.chain.reason ? <Notice tone="amber" icon="warning">{w.chain.reason}</Notice> : null}
    </Card>
  ) : null;

  const own = (
    <Card style={{ gap: S.md }}>
      <SectionTitle>Use your own wallet</SectionTitle>
      <Text style={t.body}>
        EcoLedger created an address for you. If you have MetaMask or another wallet, paste its address and future tokens will go there.
      </Text>
      {editing ? (
        <View style={{ gap: S.md }}>
          <Field label="Wallet address" value={addr} onChangeText={setAddr} placeholder="0x…" autoCapitalize="none" error={addrError} style={{ fontFamily: mono, fontSize: 14 }} />
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <Button small label="Save address" icon="checkmark" onPress={connect} loading={saving} />
            <Button small kind="ghost" label="Cancel" onPress={() => { setEditing(false); setAddrError(''); }} />
          </View>
        </View>
      ) : (
        <Button small kind="ghost" icon="link-outline" label="Connect an address" onPress={() => setEditing(true)} />
      )}
    </Card>
  );

  const history = w ? (
    <Card style={{ gap: S.sm }}>
      <SectionTitle>Mint receipts</SectionTitle>
      {w.mints.length === 0 ? (
        <Text style={[t.body, { marginTop: S.md, color: C.muted }]}>No tokens minted yet. They appear here as soon as an admin approves one of your activities.</Text>
      ) : (
        <View style={{ marginTop: S.sm }}>
          {w.mints.map((m) => (
            <View key={m._id} style={s.receipt}>
              <View style={s.receiptIcon}><Ionicons name="cube" size={16} color={C.green} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text style={t.h3} numberOfLines={1}>{m.activityType?.name || 'Activity'}</Text>
                <Pressable onPress={() => { const url = explorerLink(w.chain, 'tx', m.mintTxHash); if (url) open(url); else copy(m.mintTxHash, 'Transaction hash'); }}>
                  <Mono style={{ color: C.muted, fontSize: 12.5 }}>tx {shortHash(m.mintTxHash, 10, 6)} · block {m.mintBlock}</Mono>
                </Pressable>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text style={s.plus}>+{m.pointsEarned} CCT</Text>
                <Text style={t.small}>{timeAgo(m.verifiedAt)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  ) : null;

  return (
    <Screen role="student">
      <PageTitle title="Wallet" subtitle="Your tokens live on the blockchain, not just in our database." action={<Button small kind="ghost" icon="refresh" label="Refresh" onPress={reload} />} />
      {error ? <Notice tone="red" icon="alert-circle">{error}</Notice> : null}
      {!w ? <Empty icon="wallet-outline" title="Wallet unavailable" body="Check that the server is running and try again." /> : (
        <>
          {hero}
          <Grid cols={cols(1, 3, 3)}>
            <Stat row={isPhone} label="CCT on-chain" value={w.onChainBalance ?? '–'} icon="cube" tone="green" note={chainLive ? 'Live balanceOf() read' : 'Chain offline'} />
            <Stat row={isPhone} label="CCT recorded by EcoLedger" value={w.recordedTokens} icon="document-text" tone="sage" note="Total ever minted to you" />
            <Stat row={isPhone} label="Eco points to spend" value={w.ecoPoints} icon="sparkles" tone="rose" note="Used for rewards" />
          </Grid>
          {mismatch ? (
            <Notice tone="amber" icon="information-circle">
              The on-chain balance is lower than EcoLedger{"'"}s record. This happens on a local test chain after it restarts, because a fresh chain starts empty. Tokens minted from now on will show up normally.
            </Notice>
          ) : null}
          {isDesktop ? (
            <View style={{ flexDirection: 'row', gap: S.xl, alignItems: 'flex-start' }}>
              <View style={{ flex: 1.5 }}>{history}</View>
              <View style={{ flex: 1, gap: S.xl }}>{chain}{own}</View>
            </View>
          ) : (
            <>
              {history}
              {chain}
              {own}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function Row({ label, value, mono: isMono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <View style={s.row}>
      <Text style={t.small}>{label}</Text>
      <Pressable onPress={onCopy} disabled={!onCopy} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
        {isMono ? <Mono numberOfLines={1}>{value}</Mono> : <Text style={s.rowValue} numberOfLines={1}>{value}</Text>}
        {onCopy ? <Ionicons name="copy-outline" size={14} color={C.muted} /> : null}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: C.green, borderRadius: R.xl, gap: S.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.md, flexWrap: 'wrap' },
  heroLabel: { fontFamily: font, fontSize: 14, fontWeight: '700', color: C.blush },
  heroValue: { fontFamily: font, fontSize: 60, fontWeight: '800', color: '#fff', letterSpacing: -2, lineHeight: 66 },
  heroUnit: { fontFamily: font, fontSize: 20, fontWeight: '800', color: C.pink, marginBottom: 10 },
  addr: { flexDirection: 'row', alignItems: 'center', gap: S.sm, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: R.pill },
  addrText: { fontFamily: mono, fontSize: 13.5, color: '#fff', flexShrink: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: S.md, paddingVertical: 6 },
  rowValue: { fontFamily: font, fontSize: 14, fontWeight: '600', color: C.ink, flexShrink: 1 },
  receipt: { flexDirection: 'row', alignItems: 'center', gap: S.md, paddingVertical: S.md, borderBottomWidth: 1, borderBottomColor: C.line },
  receiptIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.greenTint, alignItems: 'center', justifyContent: 'center' },
  plus: { fontFamily: font, fontSize: 15, fontWeight: '800', color: C.green },
});
