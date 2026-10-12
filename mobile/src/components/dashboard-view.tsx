import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, extractRecords, findArrayByKey, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { adminService } from '@/services/admin.service';
import { hrService } from '@/services/hr.service';
import { marketingService } from '@/services/marketing.service';
import { salesService } from '@/services/sales.service';
import { serviceAdminService } from '@/services/serviceAdmin.service';
import { workspaceService } from '@/services/workspace.service';
import type { User } from '@/types/auth';

const MANAGEMENT_ROLES = [
  'ADMIN', 'CEO', 'HEAD', 'MANAGER', 'PRODUCT_HEAD', 'MARKETING_HEAD', 'FINANCE_HEAD', 'SALES_HEAD', 'PROJECTS_HEAD', 'SUPPORT_HEAD',
  'HR_HEAD', 'DESIGN_HEAD', 'ENGINEERING_HEAD', 'PRODUCT_MANAGER', 'MARKETING_MANAGER', 'FINANCE_MANAGER', 'SALES_MANAGER',
  'PROJECTS_MANAGER', 'SUPPORT_MANAGER', 'HR_MANAGER', 'DESIGN_MANAGER', 'ENGINEERING_MANAGER', 'HR', 'CFO',
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const buildLoaders = (user: User | null) => {
  const roles = user?.roles ?? [];
  const department = user?.organization_department ?? '';
  const has = (role: string) => roles.includes(role);
  const loaders: { label: string; load: () => Promise<unknown> }[] = [];

  if (department === 'SALES' && (has('SALES_HEAD') || has('SALES_MANAGER') || has('ADMIN'))) {
    loaders.push({ label: 'Sales dashboard', load: () => salesService.dashboard() });
  }
  if (department === 'MARKETING' && (has('MARKETING_HEAD') || has('MARKETING_MANAGER') || has('ADMIN'))) {
    loaders.push({ label: 'Marketing dashboard', load: () => marketingService.dashboard() });
  }
  if (['HR', 'HR_HEAD', 'HR_MANAGER'].some(has)) {
    loaders.push({ label: 'HR dashboard', load: () => hrService.dashboard() });
  }
  if (has('ADMIN')) loaders.push({ label: 'Governance overview', load: () => adminService.overview() });
  if (has('INVESTOR')) loaders.push({ label: 'Investor analytics', load: () => workspaceService.analytics() });
  if (has('CUSTOMER')) {
    loaders.push({
      label: 'Customer overview',
      load: async () => ({ requests: await serviceAdminService.customerRequests(), projects: await serviceAdminService.customerProjects() }),
    });
  }
  if (has('INTERN')) loaders.push({ label: 'Intern dashboard', load: () => workspaceService.roleDashboard('intern') });
  if (has('EMPLOYEE')) loaders.push({ label: 'Employee dashboard', load: () => workspaceService.roleDashboard('employee') });
  if (MANAGEMENT_ROLES.some(has)) {
    loaders.push({ label: 'Team delivery', load: async () => ({ workflow: await workspaceService.workflowTasks(), organization: await workspaceService.organization() }) });
  }
  loaders.push({
    label: 'My work',
    load: async () => ({ tasks: await workspaceService.tasks(), attendance: await workspaceService.attendance() }),
  });
  return loaders;
};

const statsOf = (data: unknown): { label: string; value: string | number }[] => {
  if (!data || typeof data !== 'object') return [];
  const stats = (data as Record<string, unknown>).stats;
  if (!stats || typeof stats !== 'object') return [];
  return Object.entries(stats as Record<string, unknown>)
    .filter(([, value]) => ['string', 'number'].includes(typeof value) && value !== null)
    .map(([key, value]) => ({ label: key.replaceAll('_', ' '), value: value as string | number }));
};

export function DashboardView({ user }: { user: User | null }) {
  const [data, setData] = useState<unknown>(null);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    const loaders = buildLoaders(user);
    const attempt = async (): Promise<{ label: string; data: unknown }> => {
      let lastError: unknown;
      for (const loader of loaders) {
        try {
          return { label: loader.label, data: await loader.load() };
        } catch (loadError) {
          lastError = loadError;
        }
      }
      throw lastError;
    };
    void attempt()
      .then((result) => {
        if (!active) return;
        setData(result.data);
        setSource(result.label);
      })
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Your dashboard could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user, reloadKey]);

  const tasks = findArrayByKey(data, ['tasks', 'items', 'results']);
  const records = tasks.length ? [] : extractRecords(data).slice(0, 12);
  const stats = statsOf(data);

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow={greeting()} title={user?.user_name.split(' ')[0] ?? 'Overview'} description={`${source || 'Your'} at a glance — projects, tasks and approvals for your account.`} />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          <StatGrid items={stats} />
          {tasks.length ? (
            <View className="gap-2.5">
              {tasks.slice(0, 8).map((task, index) => {
                const record = (typeof task === 'object' && task ? task : {}) as Record<string, unknown>;
                const status = typeof record.status === 'string' ? record.status : undefined;
                return (
                  <DataCard key={toId(record, index)} title={recordTitle(record, index)} subtitle={typeof record.description === 'string' ? record.description.slice(0, 140) : undefined} badge={status}>
                    <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 3)}</Text>
                  </DataCard>
                );
              })}
            </View>
          ) : null}
          {records.length ? (
            <View className="gap-2.5">
              {records.map((record, index) => (
                <DataCard key={toId(record, index)} title={recordTitle(record, index)} badge={typeof record.status === 'string' ? record.status : undefined}>
                  <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 4)}</Text>
                </DataCard>
              ))}
            </View>
          ) : null}
          {!stats.length && !tasks.length && !records.length ? (
            <EmptyHint icon="grid-outline" title="Nothing new today" description="Assignments and updates will appear here as soon as they arrive." />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
