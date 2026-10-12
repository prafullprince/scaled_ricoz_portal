import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar, extractRecords, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';
import { useAppSelector } from '@/store/hooks';

const TABS = [
  { value: 'team', label: 'TEAM' },
  { value: 'delivery', label: 'DELIVERY' },
  { value: 'insights', label: 'INSIGHTS' },
];

type Row = Record<string, unknown>;

const personId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return String((value as Row)._id ?? '');
  return '';
};

export function TeamView() {
  const user = useAppSelector((state) => state.auth.user);
  const [tab, setTab] = useState('team');
  const [workflow, setWorkflow] = useState<{ tasks: Row[]; subtasks: Row[] }>({ tasks: [], subtasks: [] });
  const [organization, setOrganization] = useState<Row[]>([]);
  const [performance, setPerformance] = useState<unknown>(null);
  const [progress, setProgress] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    const loadWorkflow = async () => {
      try {
        const payload = (await workspaceService.workflowTasks()) as Record<string, unknown>;
        return {
          tasks: (Array.isArray(payload.tasks) ? payload.tasks : []) as Row[],
          subtasks: (Array.isArray(payload.subtasks) ? payload.subtasks : []) as Row[],
        };
      } catch {
        return { tasks: [], subtasks: [] };
      }
    };
    const loadOrganization = async () => {
      try {
        return extractRecords(await workspaceService.organization());
      } catch {
        return [] as Row[];
      }
    };
    const loadInsights = async () => {
      try {
        const [nextPerformance, nextProgress] = await Promise.all([workspaceService.workflowPerformance(), workspaceService.workflowProgress()]);
        return { nextPerformance, nextProgress };
      } catch {
        return { nextPerformance: null, nextProgress: null };
      }
    };
    Promise.all([loadWorkflow(), loadOrganization(), loadInsights()])
      .then(([nextWorkflow, nextOrganization, nextInsights]) => {
        if (!active) return;
        setWorkflow(nextWorkflow);
        setOrganization(nextOrganization);
        setPerformance(nextInsights.nextPerformance);
        setProgress(nextInsights.nextProgress);
      })
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Your manager workspace could not be loaded.')))
      .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
      }, [reloadKey]);

  const members = (() => {
    const levelMember = organization.filter((item) => item.level === 'MEMBER');
    const direct = levelMember.filter((item) => personId(item.reportsTo) === user?.user_id);
    return direct.length ? direct : levelMember;
  })();

  const statsFor = (member: Row) => {
    const userIdValue = member.userId as unknown;
    const memberId = personId(userIdValue) || String(member._id ?? '');
    const assigned = workflow.subtasks.filter((task) => personId(task.assignedTo) === memberId);
    const active = assigned.filter((task) => task.workflowStage === 'ASSIGNED').length;
    const review = assigned.filter((task) => task.workflowStage === 'SUBMITTED').length;
    const done = assigned.filter((task) => task.workflowStage === 'COMPLETED' || task.status === 'DONE').length;
    const overdue = assigned.filter((task) => task.status !== 'DONE' && task.deadline && new Date(String(task.deadline)) < new Date()).length;
    return { active, review, done, overdue, total: assigned.length };
  };

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="My team" title="Team workspace" description="Capacity, delivery pipeline and hierarchy insights." />
      <TabBar onChange={setTab} options={TABS} value={tab} />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          {tab === 'team' ? (
            members.length ? (
              <View className="gap-2.5">
                {members.map((member, index) => {
                  const stats = statsFor(member);
                  const userIdValue = member.userId as unknown;
                  const name = userIdValue && typeof userIdValue === 'object'
                    ? String((userIdValue as Row).user_name ?? (userIdValue as Row).name ?? recordTitle(member, index))
                    : recordTitle(member, index);
                  return (
                    <DataCard key={toId(member, index)} badge={`${stats.total} tasks`} subtitle={typeof member.department === 'string' ? member.department : undefined} title={name}>
                      <StatGrid items={[
                        { label: 'Active', value: stats.active },
                        { label: 'In review', value: stats.review },
                        { label: 'Accepted', value: stats.done },
                        { label: 'Overdue', value: stats.overdue },
                      ]} />
                    </DataCard>
                  );
                })}
              </View>
            ) : (
              <EmptyHint description="Team members reporting to you will appear here." icon="people-outline" title="No direct reports" />
            )
          ) : null}
          {tab === 'delivery' ? (
            workflow.tasks.length ? (
              <View className="gap-2.5">
                {workflow.tasks.map((task, index) => {
                  const workItems = workflow.subtasks.filter((item) => personId(item.parent ?? item.parentId) === String(task._id ?? ''));
                  const done = workItems.filter((item) => item.status === 'DONE').length;
                  const percent = workItems.length ? Math.round((done / workItems.length) * 100) : task.status === 'DONE' ? 100 : 0;
                  return (
                    <DataCard key={toId(task, index)} badge={typeof task.workflowStage === 'string' ? task.workflowStage : undefined} subtitle={typeof task.deadline === 'string' ? `Due ${new Date(task.deadline).toLocaleDateString('en-IN')}` : undefined} title={recordTitle(task, index)}>
                      <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(task, 3)}</Text>
                      <View className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
                        <View className="h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
                      </View>
                      <Text className="mt-1 font-sans text-[11px] text-muted">{workItems.length ? `${done}/${workItems.length} work items · ` : ''}{percent}%</Text>
                    </DataCard>
                  );
                })}
              </View>
            ) : (
              <EmptyHint description="Incoming delivery plans will appear here for breakdown." icon="git-branch-outline" title="No delivery items" />
            )
          ) : null}

          {tab === 'insights' ? (
            <>
              <Text className="mt-2 font-bold text-base text-ink">Performance</Text>
              {extractRecords(performance).length ? (
                <View className="gap-2.5">
                  {extractRecords(performance).map((record, index) => (
                    <DataCard key={toId(record, index)} title={recordTitle(record, index)}>
                      <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 5)}</Text>
                    </DataCard>
                  ))}
                </View>
              ) : (
                <EmptyHint description="Hierarchy performance will appear once teams log progress." icon="bar-chart-outline" title="No performance data" />
              )}
              <Text className="mt-2 font-bold text-base text-ink">Progress</Text>
              {extractRecords(progress).length ? (
                <View className="gap-2.5">
                  {extractRecords(progress).map((record, index) => (
                    <DataCard key={toId(record, index)} title={recordTitle(record, index)}>
                      <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 5)}</Text>
                    </DataCard>
                  ))}
                </View>
              ) : (
                <EmptyHint description="Hierarchy progress will appear once teams log progress." icon="trending-up-outline" title="No progress data" />
              )}
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
