import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { ActionChip, EmptyHint, ErrorBanner, Loader } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { notificationsService, type NotificationPage, type TaskNotification } from '@/services/notifications.service';

export function NotificationsView() {
  const [page, setPage] = useState<NotificationPage | null>(null);
  const [items, setItems] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (reset = true) => {
    const nextPage = reset ? 1 : (page?.pagination.page ?? 1) + 1;
    const result = await notificationsService.list(nextPage);
    setPage(result);
    setItems((current) => (reset ? result.notifications : [...current, ...result.notifications]));
  }, [page]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    notificationsService
      .list(1)
      .then((result) => {
        if (!active) return;
        setPage(result);
        setItems(result.notifications);
      })
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Notifications could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      await load(true);
    } catch (loadError) {
      Alert.alert('Notifications', getApiErrorMessage(loadError, 'This action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const hasMore = Boolean(page && page.pagination.page < page.pagination.totalPages);

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader
        action={<ActionChip disabled={busy || !page?.unread} label="Mark all read" tone="primary" onPress={() => void run(() => notificationsService.readAll())} />}
        description="Task updates and workspace alerts for your account."
        eyebrow="My account"
        title="Notifications"
      />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          {items.length ? (
            <View className="gap-2.5">
              {items.map((item) => (
                <View key={item._id} className={`gap-1 rounded-card border p-4 ${item.readAt ? 'border-line bg-white' : 'border-teal/40 bg-mint'}`}>
                  <View className="flex-row items-start justify-between gap-3">
                    <Text className="flex-1 font-bold text-[14px] text-ink">{item.title}</Text>
                    <View className={`h-2 w-2 rounded-full ${item.readAt ? 'bg-line' : 'bg-success'}`} />
                  </View>
                  <Text className="font-sans text-[13px] leading-5 text-muted">{item.message}</Text>
                  <View className="flex-row items-center justify-between gap-3 pt-1">
                    <Text className="font-sans text-[11px] text-muted">{new Date(item.createdAt).toLocaleString()}</Text>
                    <ActionChip disabled={busy} label="Delete" tone="danger" onPress={() => void run(() => notificationsService.remove(item._id))} />
                  </View>
                </View>
              ))}
              {hasMore ? (
                <Pressable className="h-11 items-center justify-center rounded-card border border-line bg-white active:opacity-70" disabled={busy} onPress={() => void load(false)}>
                  <Text className="font-bold text-[13px] text-ink">Load more</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <EmptyHint icon="notifications-outline" title="No notifications yet" description="Task updates and approval alerts will land here." />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
