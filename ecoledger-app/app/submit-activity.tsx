/**
 * Log an eco-action. Points come from the activity type on the server, so the
 * student only picks a type, describes it and attaches a photo.
 * If the server can't be reached, the activity is saved on the device and sent later.
 */
import React, { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { C, font, R, S } from '@/constants/theme';
import { api, ActivityType, ApiError } from '@/lib/api';
import { buildForm, queueDraft } from '@/lib/queue';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { Button, Card, Field, IconName, Loading, Notice, PageTitle, Screen, SectionTitle, t, useLayout } from '@/components/ui';

const STEPS = [
  'Pick the activity and describe what you did.',
  'Attach a clear photo as proof.',
  'An admin reviews it, usually within a day.',
  'Once approved, the points are added and the same number of CCT is minted to your wallet.',
];

export default function SubmitActivity() {
  const router = useRouter();
  const { toast, refreshUser, refreshQueue } = useSession();
  const { isDesktop, cols } = useLayout();
  const types = useLoad(() => api.activityTypes());
  const [type, setType] = useState<ActivityType | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState(false);

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && Platform.OS !== 'web') {
      setFormError(camera ? 'Camera access is needed to take a photo.' : 'Photo access is needed to attach proof.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]) { setImage(r.assets[0].uri); setErrors((e) => ({ ...e, image: '' })); }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!type) e.type = 'Choose what kind of activity this was.';
    if (description.trim().length < 5) e.description = 'Add a sentence about what you did.';
    if (!image) e.image = 'A photo is needed so the admin can verify it.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const reset = () => { setType(null); setDescription(''); setLocation(''); setImage(null); setErrors({}); };

  const submit = async () => {
    setFormError('');
    if (!validate() || !type) return;
    setSending(true);
    const draft = { activityType: type._id, description: description.trim(), location: location.trim(), imageUri: image };
    try {
      await api.submitActivity(await buildForm(draft));
      toast('Activity sent for review.', 'good');
      reset();
      refreshUser();
      router.push('/activities');
    } catch (e) {
      if (e instanceof ApiError && e.offline) {
        await queueDraft({ ...draft, typeName: type.name, savedAt: new Date().toISOString() });
        await refreshQueue();
        toast('Server offline. Saved on this device and will send automatically.', 'info');
        reset();
        router.push('/');
      } else {
        setFormError(e instanceof Error ? e.message : 'Could not submit the activity.');
      }
    } finally {
      setSending(false);
    }
  };

  const form = (
    <Card style={{ gap: S.xl }}>
      <View style={{ gap: S.md }}>
        <Text style={s.label}>Activity type</Text>
        {types.loading ? <Loading /> : types.error ? <Notice tone="red">{types.error}</Notice> : (
          <View style={s.chips}>
            {(types.data || []).map((ty) => {
              const on = type?._id === ty._id;
              return (
                <Pressable
                  key={ty._id}
                  onPress={() => { setType(ty); setErrors((e) => ({ ...e, type: '' })); }}
                  style={({ hovered }: any) => [s.chip, { flexBasis: `${100 / cols(2, 3, 3) - 2}%` as any }, on && s.chipOn, hovered && !on && { borderColor: C.pink }]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons name={(ty.icon || 'leaf-outline') as IconName} size={20} color={on ? '#fff' : C.green} />
                  <Text style={[s.chipName, on && { color: '#fff' }]} numberOfLines={2}>{ty.name}</Text>
                  <Text style={[s.chipPts, on && { color: C.blush }]}>+{ty.points} pts</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {errors.type ? <Text style={s.error}>{errors.type}</Text> : null}
      </View>

      <Field label="What did you do?" value={description} onChangeText={(v) => { setDescription(v); if (errors.description) setErrors((e) => ({ ...e, description: '' })); }} placeholder="e.g. Planted six saplings along the hostel boundary with the green society." multiline error={errors.description} />
      <Field label="Where? (optional)" value={location} onChangeText={setLocation} placeholder="e.g. North lawn, main campus" />

      <View style={{ gap: S.md }}>
        <Text style={s.label}>Photo proof</Text>
        {image ? (
          <View style={s.preview}>
            <Image source={{ uri: image }} style={s.previewImg} resizeMode="cover" />
            <Pressable onPress={() => setImage(null)} style={s.remove} accessibilityLabel="Remove photo">
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => pick(false)} style={({ hovered }: any) => [s.drop, !!errors.image && { borderColor: C.red }, hovered && { backgroundColor: C.roseTint }]}>
            <Ionicons name="image-outline" size={28} color={C.rose} />
            <Text style={t.h3}>Choose a photo</Text>
            <Text style={t.small}>JPG or PNG, up to 8 MB</Text>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', gap: S.sm, flexWrap: 'wrap' }}>
          {image ? <Button small kind="ghost" icon="images-outline" label="Choose another" onPress={() => pick(false)} /> : null}
          {Platform.OS !== 'web' ? <Button small kind="ghost" icon="camera-outline" label="Take a photo" onPress={() => pick(true)} /> : null}
        </View>
        {errors.image ? <Text style={s.error}>{errors.image}</Text> : null}
      </View>

      {formError ? <Notice tone="red" icon="alert-circle">{formError}</Notice> : null}
      <Button full label={type ? `Submit for review · +${type.points} pts` : 'Submit for review'} icon="paper-plane-outline" onPress={submit} loading={sending} />
    </Card>
  );

  const aside = (
    <Card style={{ gap: S.lg, backgroundColor: C.greenTint, borderColor: '#D3E6D6' }}>
      <SectionTitle>How it works</SectionTitle>
      <View style={{ gap: S.md, marginTop: S.sm }}>
        {STEPS.map((step, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: S.md }}>
            <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
            <Text style={[t.body, { flex: 1 }]}>{step}</Text>
          </View>
        ))}
      </View>
      <Notice tone="green" icon="cloud-offline-outline">No connection? Your activity is kept on this device and sent when the server is back.</Notice>
    </Card>
  );

  return (
    <Screen role="student" maxWidth={1040}>
      <PageTitle title="Log an activity" subtitle="Tell us what you did for the planet today." />
      {isDesktop ? (
        <View style={{ flexDirection: 'row', gap: S.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.6 }}>{form}</View>
          <View style={{ flex: 1 }}>{aside}</View>
        </View>
      ) : (
        <>
          {form}
          {aside}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: font, fontSize: 13, fontWeight: '700', color: C.green, letterSpacing: 0.2 },
  error: { fontFamily: font, fontSize: 13, color: C.red, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  chip: { flexGrow: 1, gap: 6, padding: S.md, borderRadius: R.md, borderWidth: 1.5, borderColor: C.line, backgroundColor: '#FFFBFC' },
  chipOn: { backgroundColor: C.green, borderColor: C.green },
  chipName: { fontFamily: font, fontSize: 14.5, fontWeight: '700', color: C.ink },
  chipPts: { fontFamily: font, fontSize: 13, fontWeight: '700', color: C.rose },
  drop: { height: 170, borderRadius: R.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.lineStrong, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFBFC' },
  preview: { borderRadius: R.lg, overflow: 'hidden', aspectRatio: 4 / 3, maxHeight: 340, backgroundColor: C.blush },
  previewImg: { width: '100%', height: '100%' },
  remove: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(27,43,36,0.6)', alignItems: 'center', justifyContent: 'center' },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: font, fontSize: 13, fontWeight: '800', color: '#fff' },
});
