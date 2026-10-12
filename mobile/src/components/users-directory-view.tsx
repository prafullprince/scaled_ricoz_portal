import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, extractRecords, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { directoryService } from '@/services/directory.service';

export function UsersDirectoryView() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    directoryService
      .users(query.trim() ? { search: query.trim(), pageSize: 50 } : { pageSize: 50 })
      .then((payload) => active && setUsers(extractRecords(payload)))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'The user directory could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [query, reloadKey]);

  const toggleStatus = (user: Record<string, unknown>) => {
    const userId = String(user._id ?? user.id ?? '');
    if (!userId) return;
    const current = String(user.status ?? 'ACTIVE');
    const next = current === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    Alert.alert(next === 'SUSPENDED' ? 'Suspend user?' : 'Activate user?', `This changes the account status to ${next}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: next === 'SUSPENDED' ? 'destructive' : 'default',
        onPress: async () => {
          setBusy(true);
          try {
            await directoryService.updateStatus(userId, next as 'ACTIVE' | 'SUSPENDED');
            setReloadKey((value) => value + 1);
          } catch (loadError) {
            Alert.alert('User directory', getApiErrorMessage(loadError, 'Unable to update this user.'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Administration" title="Users base" description="Search every account and manage its active status." />
      <TextInput
        className="min-h-12 rounded-card border border-line bg-white px-4 font-medium text-[15px] text-ink"
        onChangeText={setQuery}
        placeholder="Search by name or email"
        placeholderTextColor={colors.muted}
        value={query}
      />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        users.length ? (
          <View className="gap-2.5">
            {users.map((user, index) => {
              const status = typeof user.status === 'string' ? user.status : undefined;
              return (
                <DataCard
                  key={toId(user, index)}
                  actions={
                    <ActionChip
                      disabled={busy}
                      label={status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      onPress={() => toggleStatus(user)}
                      tone={status === 'ACTIVE' ? 'danger' : 'primary'}
                    />
                  }
                  badge={status}
                  subtitle={typeof user.user_email === 'string' ? user.user_email : typeof user.email === 'string' ? user.email : undefined}
                  title={recordTitle(user, index)}
                >
                  <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(user, 3)}</Text>
                </DataCard>
              );
            })}
          </View>
        ) : (
          <EmptyHint description="No accounts match this search." icon="people-outline" title="No users found" />
        )
      ) : null}
    </ScrollView>
  );
}
