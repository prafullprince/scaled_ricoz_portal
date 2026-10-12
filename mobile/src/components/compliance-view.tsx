import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { complianceService } from '@/services/compliance.service';

const TABS = [
  { value: 'dashboard', label: 'OVERVIEW' },
  { value: 'requirements', label: 'REQUIREMENTS' },
  { value: 'policies', label: 'POLICIES' },
  { value: 'risks', label: 'RISKS' },
  { value: 'issues', label: 'ISSUES' },
];

type Row = Record<string, unknown>;

const asRows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

const statsOf = (dashboard: unknown): { label: string; value: string | number }[] => {
  if (!dashboard || typeof dashboard !== 'object') return [];
  const source = (dashboard as Record<string, unknown>).stats ?? (dashboard as Record<string, unknown>).summary ?? dashboard;
  if (!source || typeof source !== 'object') return [];
  return Object.entries(source as Record<string, unknown>)
    .filter(([, value]) => ['string', 'number'].includes(typeof value))
    .slice(0, 6)
    .map(([key, value]) => ({ label: key.replaceAll('_', ' '), value: value as string | number }));
};

export function ComplianceView() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState<unknown>(null);
  const [requirements, setRequirements] = useState<Row[]>([]);
  const [policies, setPolicies] = useState<Row[]>([]);
  const [risks, setRisks] = useState<Row[]>([]);
  const [issues, setIssues] = useState<Row[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    Promise.all([
      complianceService.dashboard(),
      complianceService.requirements(),
      complianceService.policies(),
      complianceService.risks(),
      complianceService.issues(),
    ])
      .then(([nextDashboard, nextRequirements, nextPolicies, nextRisks, nextIssues]) => {
        if (!active) return;
        setDashboard(nextDashboard);
        setRequirements(asRows((nextRequirements as Row)?.requirements ?? nextRequirements));
        setPolicies(asRows(nextPolicies));
        setRisks(asRows(nextRisks));
        setIssues(asRows(nextIssues));
      })
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'The compliance center could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (loadError) {
      Alert.alert('Compliance', getApiErrorMessage(loadError, 'This action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const decideRequirement = (requirementId: string, decision: 'APPROVE' | 'REJECT') =>
    run(async () => {
      const reason = reasons[requirementId]?.trim();
      if (decision === 'REJECT' && !reason) throw new Error('A reason is required when rejecting.');
      await complianceService.decideRequirement(requirementId, decision, reason);
      setReasons((current) => ({ ...current, [requirementId]: '' }));
    });

  const dashboardStats = statsOf(dashboard);

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Governance" title="Compliance center" description="Requirements, policies, risks and issues across the company." />
      <TabBar onChange={setTab} options={TABS} value={tab} />
      {loading ? <Loader color={colors.teal} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          {tab === 'dashboard' ? (
            dashboardStats.length ? (
              <StatGrid items={dashboardStats} />
            ) : (
              <EmptyHint description="Compliance metrics will appear once requirements are tracked." icon="shield-checkmark-outline" title="No metrics yet" />
            )
          ) : null}
          {tab === 'requirements' ? (
            requirements.length ? (
              <View className="gap-2.5">
                {requirements.map((requirement, index) => {
                  const id = toId(requirement, index);
                  return (
                    <DataCard
                      key={id}
                      actions={
                        <>
                          <ActionChip disabled={busy} label="Approve" onPress={() => void decideRequirement(id, 'APPROVE')} tone="primary" />
                          <ActionChip disabled={busy} label="Reject" onPress={() => void decideRequirement(id, 'REJECT')} tone="danger" />
                          <ActionChip disabled={busy} label="Submit" onPress={() => void run(() => complianceService.submitRequirement(id))} />
                        </>
                      }
                      badge={typeof requirement.status === 'string' ? requirement.status : undefined}
                      subtitle={typeof requirement.dueDate === 'string' ? `Due ${new Date(requirement.dueDate).toLocaleDateString('en-IN')}` : undefined}
                      title={String(requirement.title ?? `Requirement ${index + 1}`)}
                    >
                      <Text className="font-sans text-xs leading-4 text-muted">
                        {typeof requirement.description === 'string' ? requirement.description.slice(0, 160) : 'Review, submit or decide this requirement.'}
                      </Text>
                      <TextInput
                        className="mt-2 min-h-10 rounded-card border border-line bg-paper px-3 font-medium text-[13px] text-ink"
                        onChangeText={(value) => setReasons((current) => ({ ...current, [id]: value }))}
                        placeholder="Reason when rejecting"
                        placeholderTextColor={colors.muted}
                        value={reasons[id] ?? ''}
                      />
                    </DataCard>
                  );
                })}
              </View>
            ) : (
              <EmptyHint description="Requirements submitted by your compliance team will appear here." icon="document-text-outline" title="No requirements" />
            )
          ) : null}
          {tab === 'policies' ? (
            policies.length ? (
              <View className="gap-2.5">
                {policies.map((policy, index) => {
                  const id = toId(policy, index);
                  return (
                    <DataCard
                      key={id}
                      actions={
                        <>
                          <ActionChip disabled={busy} label="Acknowledge" onPress={() => void run(() => complianceService.acknowledgePolicy(id))} tone="primary" />
                          <ActionChip disabled={busy} label="Publish" onPress={() => void run(() => complianceService.publishPolicy(id))} />
                        </>
                      }
                      badge={typeof policy.status === 'string' ? policy.status : undefined}
                      subtitle={typeof policy.version === 'string' ? `Version ${policy.version}` : undefined}
                      title={String(policy.title ?? `Policy ${index + 1}`)}
                    >
                      <Text className="font-sans text-xs leading-4 text-muted">{typeof policy.description === 'string' ? policy.description.slice(0, 160) : 'Company policy document.'}</Text>
                    </DataCard>
                  );
                })}
              </View>
            ) : (
              <EmptyHint description="Published policies will appear here for acknowledgement." icon="book-outline" title="No policies yet" />
            )
          ) : null}
          {tab === 'risks' ? (
            risks.length ? (
              <View className="gap-2.5">
                {risks.map((risk, index) => (
                  <DataCard key={toId(risk, index)} badge={typeof risk.status === 'string' ? risk.status : undefined} title={String(risk.title ?? `Risk ${index + 1}`)}>
                    <Text className="font-sans text-xs leading-4 text-muted">
                      {[
                        typeof risk.likelihood === 'number' ? `Likelihood ${risk.likelihood}/5` : '',
                        typeof risk.impact === 'number' ? `Impact ${risk.impact}/5` : '',
                        typeof risk.description === 'string' ? risk.description.slice(0, 140) : '',
                      ].filter(Boolean).join(' · ')}
                    </Text>
                  </DataCard>
                ))}
              </View>
            ) : (
              <EmptyHint description="Logged risks will appear here." icon="warning-outline" title="No risks logged" />
            )
          ) : null}
          {tab === 'issues' ? (
            issues.length ? (
              <View className="gap-2.5">
                {issues.map((issue, index) => (
                  <DataCard key={toId(issue, index)} badge={typeof issue.severity === 'string' ? issue.severity : typeof issue.status === 'string' ? issue.status : undefined} title={String(issue.title ?? `Issue ${index + 1}`)}>
                    <Text className="font-sans text-xs leading-4 text-muted">{typeof issue.description === 'string' ? issue.description.slice(0, 160) : 'Compliance issue under review.'}</Text>
                  </DataCard>
                ))}
              </View>
            ) : (
              <EmptyHint description="Raised issues will appear here for tracking." icon="alert-circle-outline" title="No issues yet" />
            )
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
