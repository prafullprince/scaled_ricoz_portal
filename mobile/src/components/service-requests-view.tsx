import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, TabBar, extractRecords, recordSummary, recordTitle } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { serviceAdminService } from '@/services/serviceAdmin.service';

const TABS = [
  { value: 'requests', label: 'REQUESTS' },
  { value: 'catalog', label: 'CATALOG' },
];

const STATUSES = ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'] as const;

export function ServiceRequestsView() {
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    Promise.all([serviceAdminService.adminRequests(), serviceAdminService.adminList()])
      .then(([nextRequests, nextServices]) => {
        if (!active) return;
        setRequests(extractRecords(nextRequests));
        setServices(extractRecords(nextServices));
      })
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Service administration data could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (loadError) {
      Alert.alert('Services', getApiErrorMessage(loadError, 'This action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const rows = tab === 'requests' ? requests : services;

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="Services" title="Service requests" description="Review incoming project requests and manage the service catalog." />
      <TabBar onChange={setTab} options={TABS} value={tab} />
      {loading ? <Loader color="#176B68" /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        rows.length ? (
          <View className="gap-2.5">
            {rows.map((row, index) => {
              const rowId = String(row._id ?? row.id ?? index);
              return (
                <DataCard
                  key={rowId}
                  badge={typeof row.status === 'string' ? row.status : undefined}
                  subtitle={typeof row.projectTitle === 'string' ? row.projectTitle : typeof row.category === 'string' ? row.category : undefined}
                  title={recordTitle(row, index)}
                >
                  <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(row, 4)}</Text>
                  <View className="flex-row flex-wrap gap-2 pt-1">
                    {tab === 'requests' ? (
                      <>
                        <ActionChip disabled={busy} label="Accept" onPress={() => void run(() => serviceAdminService.acceptRequest(rowId))} tone="primary" />
                        <ActionChip disabled={busy} label="Decline" onPress={() => void run(() => serviceAdminService.declineRequest(rowId))} tone="danger" />
                        <ActionChip disabled={busy} label="Mark done" onPress={() => void run(() => serviceAdminService.completeRequest(rowId))} />
                      </>
                    ) : (
                      STATUSES.map((status) => (
                        <ActionChip disabled={busy} key={status} label={`Set ${status}`} onPress={() => void run(() => serviceAdminService.changeStatus(rowId, status))} />
                      ))
                    )}
                  </View>
                </DataCard>
              );
            })}
          </View>
        ) : (
          <EmptyHint description={tab === 'requests' ? 'Incoming service requests will appear here.' : 'Your published services will appear here.'} icon="layers-outline" title="Nothing here yet" />
        )
      ) : null}
    </ScrollView>
  );
}
