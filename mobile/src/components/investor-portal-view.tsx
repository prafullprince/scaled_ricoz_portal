import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { InvestorVerificationView } from '@/components/investor-verification-view';
import { DataCard, EmptyHint, ErrorBanner, Loader, TabBar, extractRecords, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

const TABS = [
  { value: 'overview', label: 'OVERVIEW' },
  { value: 'verification', label: 'VERIFICATION' },
  { value: 'investments', label: 'INVESTMENTS' },
  { value: 'documents', label: 'DOCUMENTS' },
  { value: 'updates', label: 'UPDATES' },
];

export function InvestorPortalView() {
  const [tab, setTab] = useState('overview');
  const [analytics, setAnalytics] = useState<unknown>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); setForbidden(false); } });
    (async () => {
      try {
        await workspaceService.gate('investor');
      } catch (gateError) {
        const status = (gateError as { response?: { status?: number } }).response?.status;
        if (status === 403) {
          if (active) setForbidden(true);
          return;
        }
        throw gateError;
      }
      try {
        const overview = await workspaceService.analytics();
        if (active) setAnalytics(overview);
      } catch {
        if (active) setAnalytics(null);
      }
    })()
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Your investor portal could not be loaded.')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  if (tab === 'verification') {
    return <View className="flex-1 bg-canvas"><View className="px-5 pb-2 pt-4"><TabBar onChange={setTab} options={TABS} value={tab} /></View><InvestorVerificationView /></View>;
  }

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      {tab !== 'verification' ? (
        <PageHeader eyebrow="Investor" title="Investor portal" description="Overview, verification, investments, documents and updates." />
      ) : null}
      <TabBar onChange={setTab} options={TABS} value={tab} />
      {loading ? <Loader color={colors.teal} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {forbidden && !loading ? (
        <View className="gap-2 rounded-card border border-line bg-white p-5">
          <Text className="font-bold text-[15px] text-ink">Your account does not have access to this area yet.</Text>
          <Text className="font-sans text-[13px] leading-5 text-muted">Investor access is granted after your verification is approved.</Text>
        </View>
      ) : null}
      {!loading && !error && !forbidden ? (
        <>
          {tab === 'overview' ? (
            analytics ? (
              <View className="gap-2.5">
                {extractRecords(analytics).slice(0, 10).map((record, index) => (
                  <DataCard key={toId(record, index)} title={recordTitle(record, index)}>
                    <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 5)}</Text>
                  </DataCard>
                ))}
              </View>
            ) : (
              <EmptyHint description="Revenue, growth and operating metrics will appear here." icon="bar-chart-outline" title="No analytics yet" />
            )
          ) : null}
          {tab === 'investments' ? <EmptyHint description="Your investment portfolio will appear here once recorded." icon="trending-up-outline" title="No investments yet" /> : null}
          {tab === 'documents' ? <EmptyHint description="Shared documents and agreements will appear here." icon="document-attach-outline" title="No documents yet" /> : null}
          {tab === 'updates' ? <EmptyHint description="Investor updates from the Ricoz team will appear here." icon="megaphone-outline" title="No updates yet" /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}
