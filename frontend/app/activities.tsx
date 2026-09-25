/**
 * Everything the student has logged, filterable by review status.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { S } from '@/constants/theme';
import { api, Status } from '@/lib/api';
import { useLoad } from '@/lib/useLoad';
import { ActivityRow } from '@/components/activity';
import { Button, Card, Empty, Loading, Notice, PageTitle, Screen, Segmented } from '@/components/ui';

type Filter = 'all' | Status;

export default function Activities() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const { data, loading, error } = useLoad(() => api.myActivities());
  const list = data || [];
  const count = (f: Filter) => (f === 'all' ? list.length : list.filter((a) => a.verificationStatus === f).length);
  const shown = filter === 'all' ? list : list.filter((a) => a.verificationStatus === filter);

  return (
    <Screen role="student" maxWidth={880}>
      <PageTitle
        title="My activities"
        subtitle="Every action you have logged, with its review status and mint receipt."
        action={<Button label="Log activity" icon="add" onPress={() => router.push('/submit-activity')} />}
      />
      <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={(['all', 'pending', 'approved', 'rejected'] as Filter[]).map((f) => ({
            value: f,
            label: `${f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)} (${count(f)})`,
          }))}
        />
      </View>
      {error ? <Notice tone="red" icon="alert-circle">{error}</Notice> : null}
      {loading ? <Loading /> : shown.length === 0 ? (
        <Empty
          icon="leaf-outline"
          title={filter === 'all' ? 'No activities yet' : `No ${filter} activities`}
          body={filter === 'all' ? 'Log your first eco-action to start earning points and tokens.' : 'Try another filter.'}
          action={filter === 'all' ? <Button label="Log an activity" icon="add" onPress={() => router.push('/submit-activity')} /> : undefined}
        />
      ) : (
        <Card style={{ paddingVertical: S.sm }}>
          {shown.map((a, i) => <ActivityRow key={a._id} a={a} last={i === shown.length - 1} />)}
        </Card>
      )}
    </Screen>
  );
}
