import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader, SectionLabel } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar, extractRecords, findArrayByKey, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { hrService } from '@/services/hr.service';

const TABS = [
  { value: 'dashboard', label: 'DASHBOARD' },
  { value: 'approvals', label: 'APPROVALS' },
  { value: 'reports', label: 'AI REPORT' },
  { value: 'companies', label: 'COMPANIES' },
];

const statsOf = (dashboard: unknown): { label: string; value: string | number }[] => {
  if (!dashboard || typeof dashboard !== 'object') return [];
  const stats = (dashboard as Record<string, unknown>).stats ?? (dashboard as Record<string, unknown>);
  if (!stats || typeof stats !== 'object') return [];
  return Object.entries(stats as Record<string, unknown>)
    .filter(([, value]) => ['string', 'number'].includes(typeof value))
    .slice(0, 6)
    .map(([key, value]) => ({ label: key.replaceAll('_', ' '), value: value as string | number }));
};

export function HrWorkspaceView() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState<unknown>(null);
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [prompt, setPrompt] = useState('');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    hrService
      .dashboard()
      .then((payload) => active && setDashboard(payload))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'The HR dashboard could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (tab !== 'companies' || companies.length) return;
    let active = true;
    void Promise.resolve().then(() => { if (active) setLoadingCompanies(true); });
    hrService
      .companies()
      .then((payload) => active && setCompanies(extractRecords(payload)))
      .catch((loadError) => active && Alert.alert('HR workspace', getApiErrorMessage(loadError, 'Assigned companies could not be loaded.')))
      .finally(() => active && setLoadingCompanies(false));
    return () => { active = false; };
  }, [tab, companies.length]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (loadError) {
      Alert.alert('HR workspace', getApiErrorMessage(loadError, 'This action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const leaveRequests = findArrayByKey(dashboard, ['leaveRequests', 'pendingLeave', 'leaves', 'requests']);

  const generateReport = async () => {
    if (prompt.trim().length < 2) {
      Alert.alert('AI report', 'Describe the report you need.');
      return;
    }
    setBusy(true);
    try {
      const result = await hrService.aiReport(prompt.trim());
      setReport(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    } catch (loadError) {
      Alert.alert('AI report', getApiErrorMessage(loadError, 'The report could not be generated.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Department" title="HR workspace" description="Dashboard, leave approvals, AI reports and assigned companies." />
      <TabBar onChange={setTab} options={TABS} value={tab} />
      {loading ? <Loader color={colors.teal} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          {tab === 'dashboard' ? (
            <>
              <StatGrid items={statsOf(dashboard)} />
              <View className="gap-2.5">
                {extractRecords(dashboard).slice(0, 10).map((record, index) => (
                  <DataCard key={toId(record, index)} badge={typeof record.status === 'string' ? record.status : undefined} title={recordTitle(record, index)}>
                    <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 4)}</Text>
                  </DataCard>
                ))}
              </View>
            </>
          ) : null}
          {tab === 'approvals' ? (
            leaveRequests.length ? (
              <View className="gap-2.5">
                {leaveRequests.map((item, index) => {
                  const record = (typeof item === 'object' && item ? item : {}) as Record<string, unknown>;
                  const requestId = String(record._id ?? record.id ?? index);
                  return (
                    <DataCard
                      key={requestId}
                      badge={typeof record.status === 'string' ? record.status : undefined}
                      subtitle={`${record.startDate ?? ''} ${record.endDate ? `to ${record.endDate}` : ''}`.trim() || undefined}
                      title={recordTitle(record, index)}
                    >
                      <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 4)}</Text>
                      <View className="flex-row flex-wrap gap-2 pt-1">
                        <ActionChip disabled={busy} label="Approve" onPress={() => void run(() => hrService.reviewLeave(requestId, 'APPROVED'))} tone="primary" />
                        <ActionChip disabled={busy} label="Reject" onPress={() => void run(() => hrService.reviewLeave(requestId, 'REJECTED'))} tone="danger" />
                      </View>
                    </DataCard>
                  );
                })}
              </View>
            ) : (
              <EmptyHint description="Leave requests routed to HR will appear here." icon="flag-outline" title="No pending approvals" />
            )
          ) : null}
          {tab === 'reports' ? (
            <View className="gap-3">
              <SectionLabel>Generate HR report</SectionLabel>
              <TextInput
                className="min-h-24 rounded-card border border-line bg-white px-4 py-3 font-medium text-[14px] text-ink"
                multiline
                onChangeText={setPrompt}
                placeholder="e.g. Headcount and leave trends for this month"
                placeholderTextColor={colors.muted}
                textAlignVertical="top"
                value={prompt}
              />
              <ActionChip disabled={busy} label={busy ? 'Generating…' : 'Generate report'} onPress={() => void generateReport()} tone="primary" />
              {report ? (
                <View className="rounded-card border border-line bg-white p-4">
                  <Text className="font-sans text-[13px] leading-5 text-ink">{report}</Text>
                </View>
              ) : (
                <EmptyHint description="Ask for headcount, leave or onboarding insights and the report appears here." icon="sparkles-outline" title="No report yet" />
              )}
            </View>
          ) : null}
          {tab === 'companies' ? (
            loadingCompanies ? (
              <Loader color={colors.teal} />
            ) : companies.length ? (
              <View className="gap-2.5">
                {companies.map((company, index) => (
                  <DataCard key={toId(company, index)} badge={typeof company.status === 'string' ? company.status : undefined} title={recordTitle(company, index)}>
                    <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(company, 4)}</Text>
                  </DataCard>
                ))}
              </View>
            ) : (
              <EmptyHint description="Companies assigned to your HR account will appear here." icon="business-outline" title="No companies assigned" />
            )
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
