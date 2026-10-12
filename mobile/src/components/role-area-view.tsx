import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { EmptyHint, ErrorBanner, Loader } from '@/components/ui/view-kit';
import { PageHeader } from '@/components/ui/primitives';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type GateArea = 'customer' | 'investor' | 'intern' | 'employee';

/**
 * Mobile counterpart of the website's RoleAreaPage: the server gates the area,
 * and the section renders an honest empty state until content exists there.
 */
export function RoleAreaView({
  area,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: {
  area: GateArea;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) setState('loading'); });
    workspaceService
      .gate(area)
      .then(() => active && setState('ready'))
      .catch((error) => {
        if (!active) return;
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status === 403) setState('forbidden');
        else {
          setState('error');
          setMessage(getApiErrorMessage(error, `We couldn't load ${title.toLowerCase()}.`));
        }
      });
    return () => { active = false; };
  }, [area, title, reloadKey]);

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="Workspace" title={title} description={description} />
      {state === 'loading' ? <Loader /> : null}
      {state === 'error' ? <ErrorBanner message={message} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {state === 'forbidden' ? (
        <View className="gap-2 rounded-card border border-line bg-white p-5">
          <Text className="font-bold text-[15px] text-ink">Your account does not have access to this area yet.</Text>
          <Text className="font-sans text-[13px] leading-5 text-muted">Access is granted by the Ricoz administration team. Contact your administrator if you need this workspace.</Text>
        </View>
      ) : null}
      {state === 'ready' ? <EmptyHint icon="folder-open-outline" title={emptyTitle} description={emptyDescription} /> : null}
    </ScrollView>
  );
}
