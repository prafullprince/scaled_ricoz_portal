import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, TabBar, extractRecords, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { adminService } from '@/services/admin.service';

const TABS = [
  { value: 'system', label: 'SYSTEM HR' },
  { value: 'candidates', label: 'CANDIDATES' },
];

export function AdminHrView() {
  const [tab, setTab] = useState('system');
  const [systemHr, setSystemHr] = useState<Record<string, unknown>[]>([]);
  const [candidates, setCandidates] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    Promise.all([adminService.systemHr(), adminService.hrCandidates()])
      .then(([nextSystemHr, nextCandidates]) => {
        if (!active) return;
        setSystemHr(extractRecords(nextSystemHr));
        setCandidates(extractRecords(nextCandidates));
      })
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'HR management data could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (loadError) {
      Alert.alert('HR management', getApiErrorMessage(loadError, 'This action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const rows = tab === 'system' ? systemHr : candidates;

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="Administration" title="HR management" description="Designate system HR accounts and manage company access." />
      <TabBar onChange={setTab} options={TABS} value={tab} />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        rows.length ? (
          <View className="gap-2.5">
            {rows.map((account, index) => {
              const rawUserId = account.userId;
              const nestedUserId = typeof rawUserId === 'object' && rawUserId ? (rawUserId as Record<string, unknown>)._id : rawUserId;
              const userId = String(account._id ?? account.id ?? nestedUserId ?? '');
              return (
                <DataCard
                  key={userId || toId(account, index)}
                  badge={typeof account.active === 'boolean' ? (account.active ? 'active' : 'paused') : typeof account.status === 'string' ? account.status : undefined}
                  subtitle={typeof account.user_email === 'string' ? account.user_email : typeof account.email === 'string' ? account.email : undefined}
                  title={recordTitle(account, index)}
                >
                  <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(account, 3)}</Text>
                  <View className="flex-row flex-wrap gap-2 pt-1">
                    {tab === 'system' ? (
                      <>
                        <ActionChip disabled={busy || !userId} label="Activate" onPress={() => void run(() => adminService.setHrActive(userId, true))} tone="primary" />
                        <ActionChip disabled={busy || !userId} label="Pause" onPress={() => void run(() => adminService.setHrActive(userId, false))} />
                        <ActionChip disabled={busy || !userId} label="Remove" onPress={() => void run(() => adminService.removeHr(userId))} tone="danger" />
                      </>
                    ) : (
                      <ActionChip disabled={busy || !userId} label="Designate HR" onPress={() => void run(() => adminService.designateHr(userId))} tone="primary" />
                    )}
                  </View>
                </DataCard>
              );
            })}
          </View>
        ) : (
          <EmptyHint description={tab === 'system' ? 'Designated HR accounts will appear here.' : 'Eligible accounts will appear here for HR designation.'} icon="person-outline" title="No accounts" />
        )
      ) : null}
    </ScrollView>
  );
}
