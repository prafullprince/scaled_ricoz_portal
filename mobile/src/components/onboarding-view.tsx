import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, extractRecords, toId } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { adminService } from '@/services/admin.service';

const ASSIGNABLE_ROLES = ['HR', 'CUSTOMER', 'INVESTOR', 'EMPLOYEE', 'INTERN', 'CFO'] as const;

export function OnboardingView() {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    adminService
      .onboardingQueue()
      .then((payload) => active && setAccounts(extractRecords(payload)))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'The onboarding queue could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (loadError) {
      Alert.alert('Onboarding', getApiErrorMessage(loadError, 'This action failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="Administration" title="User onboarding" description="Review new sign-ups and assign their first company role." />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        accounts.length ? (
          <View className="gap-2.5">
            {accounts.map((account, index) => {
              const userId = String(account._id ?? account.id ?? '');
              const status = typeof account.status === 'string' ? account.status : undefined;
              return (
                <DataCard
                  key={userId || toId(account, index)}
                  badge={status}
                  subtitle={typeof account.user_email === 'string' ? account.user_email : typeof account.email === 'string' ? account.email : undefined}
                  title={String(account.user_name ?? account.name ?? `Account ${index + 1}`)}
                >
                  <View className="flex-row flex-wrap gap-2">
                    <ActionChip disabled={busy || !userId} label="Accept" onPress={() => void run(() => adminService.reviewOnboarding(userId, 'ACCEPTED'))} tone="primary" />
                    <ActionChip disabled={busy || !userId} label="Decline" onPress={() => void run(() => adminService.reviewOnboarding(userId, 'DECLINED'))} tone="danger" />
                  </View>
                  <View className="flex-row flex-wrap gap-2 pt-1">
                    {ASSIGNABLE_ROLES.map((role) => (
                      <ActionChip key={role} disabled={busy || !userId} label={`Assign ${role}`} onPress={() => void run(() => adminService.assignOnboardingRole(userId, role))} />
                    ))}
                  </View>
                </DataCard>
              );
            })}
          </View>
        ) : (
          <EmptyHint description="New accounts awaiting review will appear here." icon="person-add-outline" title="Queue is clear" />
        )
      ) : null}
    </ScrollView>
  );
}
