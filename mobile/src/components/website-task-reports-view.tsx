import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { TaskContributionGrid } from '@/components/task-contribution-grid';
import { FormScrollView } from '@/components/ui/form-scroll-view';
import { Field, IconButton, PageHeader, PrimaryButton, SectionLabel } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar } from '@/components/ui/view-kit';
import { reportTaskMatches, type PersonalTaskReport, type ReportStatus, type TeamTaskReport, type WorkspaceTask } from '@/features/task-model';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';
import { useAppSelector } from '@/store/hooks';

const departments = ['ALL', 'PRODUCT', 'MARKETING', 'FINANCE', 'SALES', 'PROJECTS', 'SUPPORT', 'HR', 'DESIGN', 'ENGINEERING'];
const statuses: { value: ReportStatus; label: string }[] = [{ value: 'ALL', label: 'All' }, { value: 'PENDING', label: 'Pending' }, { value: 'DONE', label: 'Done' }, { value: 'DELAYED', label: 'Delayed' }, { value: 'ON_TIME', label: 'On time' }];
type PerformanceRow = { key: string; label: string; subtitle: string; total: number; accepted: number; overdue: number; completionRate: number; onTimeRate: number; score: number };
type ProgressPackage = { taskId: string; title: string; department: string | null; stage: string; deadline: string; progress: number; totalWorkItems: number; submittedWorkItems: number; acceptedWorkItems: number; workItems: { taskId: string; title: string; progress: number; stage: string; assignee: { name: string } | null; report: { summary: string; progress: number; reportDate: string } | null }[] };

export function TaskReportsView({ mode }: { mode: 'mine' | 'team' }) {
  const user = useAppSelector((state) => state.auth.user);
  const executive = Boolean(user?.roles.some((role) => role === 'ADMIN' || role === 'CEO'));
  const [tab, setTab] = useState(mode === 'mine' ? 'report' : 'team');
  const [department, setDepartment] = useState(executive ? 'ALL' : user?.organization_department ?? 'ALL');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ReportStatus>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [personal, setPersonal] = useState<PersonalTaskReport | null>(null);
  const [team, setTeam] = useState<TeamTaskReport | null>(null);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [progress, setProgress] = useState<ProgressPackage[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [taskId, setTaskId] = useState('');
  const [summary, setSummary] = useState('');
  const [percent, setPercent] = useState('0');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (!active) return;
      setLoading(true); setError('');
      try {
        if (mode === 'mine') {
          const [report, mine] = await Promise.all([workspaceService.myTaskReport(), workspaceService.tasks()]);
          if (active) { setPersonal(report); setTasks(mine.tasks.filter((task) => task.status === 'PENDING' && task.workflowStage === 'ASSIGNED')); }
        } else if (tab === 'team') {
          const report = await workspaceService.adminTaskReport(query, { department, page, pageSize, status });
          if (active) setTeam(report);
        } else if (tab === 'performance') {
          const result = await workspaceService.workflowPerformance(department === 'ALL' ? undefined : department) as { leaderboard: PerformanceRow[] };
          if (active) setPerformance(result.leaderboard);
        } else {
          const result = await workspaceService.workflowProgress(department === 'ALL' ? undefined : department) as { packages: ProgressPackage[] };
          if (active) setProgress(result.packages);
        }
      } catch (loadError) { if (active) setError(getApiErrorMessage(loadError, 'Task reports could not be loaded.')); }
      finally { if (active) setLoading(false); }
    }, query ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, tab, department, query, status, page, pageSize, reload]);

  const submit = async () => {
    const value = Number(percent);
    if (!taskId || summary.trim().length < 2 || !Number.isFinite(value) || value < 0 || value > 100) { setError('Choose an active task, add a summary, and enter progress from 0 to 100.'); return; }
    setBusy(true); setError('');
    try { await workspaceService.submitDailyReport({ taskId, summary: summary.trim(), progress: value }); setSummary(''); setTab('report'); setReload((current) => current + 1); }
    catch (submitError) { setError(getApiErrorMessage(submitError, 'The report could not be saved.')); }
    finally { setBusy(false); }
  };
  const visible = (task: WorkspaceTask) => reportTaskMatches(task, status);
  const personalTasks = (personal?.tasks ?? []).filter((task) => visible(task) && `${task.title} ${task.description}`.toLowerCase().includes(query.trim().toLowerCase()));
  const tabs = mode === 'mine' ? [{ value: 'report', label: 'My report' }, { value: 'submit', label: 'New entry' }] : [{ value: 'team', label: 'Team report' }, { value: 'performance', label: 'Performance' }, { value: 'progress', label: 'Progress' }];

  return <FormScrollView className="bg-canvas" contentContainerClassName="gap-4 px-4 pb-8 pt-4">
    <PageHeader eyebrow={mode === 'mine' ? 'Personal workspace' : `${department === 'ALL' ? 'All departments' : department} workspace`} title="Task reports" action={<IconButton icon="refresh" label="Refresh reports" onPress={() => setReload((value) => value + 1)} />} />
    {mode === 'team' && executive ? <TabBar value={department} onChange={(value) => { setDepartment(value); setPage(1); }} options={departments.map((value) => ({ value, label: value === 'ALL' ? 'All reports' : value }))} /> : null}
    <TabBar value={tab} onChange={setTab} options={tabs} />
    {tab === 'team' || tab === 'report' ? <><Field icon="search-outline" placeholder="Search people or tasks" value={query} onChangeText={(value) => { setQuery(value); setPage(1); }} /><TabBar value={status} onChange={(value) => { setStatus(value as ReportStatus); setPage(1); }} options={statuses} /></> : null}
    {error && mode === 'mine' && tab === 'submit' ? <ErrorBanner message={error} /> : null}
    {loading ? <Loader /> : error && !(mode === 'mine' && tab === 'submit') ? <ErrorBanner message={error} onRetry={() => setReload((value) => value + 1)} /> : mode === 'mine' && tab === 'report' ? <>
      <StatGrid items={[{ label: 'Total', value: personal?.summary.total ?? 0 }, { label: 'Pending', value: personal?.summary.pending ?? 0 }, { label: 'Done', value: personal?.summary.done ?? 0 }, { label: 'On time', value: personal?.summary.onTime ?? 0 }, { label: 'Delayed', value: personal?.summary.delayed ?? 0 }]} />
      <TaskContributionGrid reports={personal?.dailyReports ?? []} />
      {personalTasks.length ? personalTasks.map((task) => <ReportTask key={task._id} task={task} />) : <EmptyHint title="No matching tasks" />}
    </> : mode === 'mine' && tab === 'submit' ? <View className="gap-4"><SectionLabel>New daily report</SectionLabel>{tasks.length ? tasks.map((task) => <ActionChip key={task._id} label={task.title} tone={taskId === task._id ? 'primary' : 'muted'} onPress={() => setTaskId(task._id)} />) : <EmptyHint title="No active assigned tasks" />}<Field multiline placeholder="What did you work on today?" value={summary} onChangeText={setSummary} /><Field keyboardType="number-pad" placeholder="Progress %" value={percent} onChangeText={setPercent} /><PrimaryButton label="Submit report" busy={busy} disabled={!taskId} onPress={() => void submit()} /></View> : tab === 'team' ? <>
      {team?.report.length ? team.report.map((group) => {
        const term = query.trim().toLowerCase();
        const personMatches = `${group.user.name} ${group.user.email}`.toLowerCase().includes(term);
        const filtered = group.tasks.filter((task) => visible(task) && (!term || personMatches || `${task.title} ${task.description}`.toLowerCase().includes(term)));
        const ids = new Set(filtered.map((task) => task._id));
        const reports = (group.dailyReports ?? []).filter((report) => (!term && status === 'ALL') || ids.has(report.taskId));
        const latest = reports[0];
        return <View key={group.user._id} className="gap-4 border-b border-line pb-5"><View className="gap-1"><Text className="font-semibold text-base text-ink">{group.user.name}</Text><Text className="font-sans text-xs text-muted">{group.user.email}</Text><Text className="font-sans text-xs text-muted">{group.user.roles?.includes('INTERN') ? 'Intern' : 'Employee'} / {filtered.length} tasks</Text></View>{filtered.length ? <><TaskContributionGrid reports={reports} />{latest ? <View className="gap-2 border-l-2 border-coral pl-3"><Text className="font-semibold text-xs text-muted">Latest progress update</Text><Text className="font-semibold text-xs text-ink">{latest.progress}% / {new Date(latest.reportDate).toLocaleDateString()}</Text><Text className="font-sans text-sm leading-6 text-muted">{latest.summary}</Text></View> : null}{filtered.map((task) => <ReportTask key={task._id} task={task} />)}</> : <Text className="font-sans text-sm text-muted">No assigned work in this department yet.</Text>}</View>;
      }) : <EmptyHint icon="people-outline" title="No matching contributors" />}
      <SectionLabel>People per page</SectionLabel><TabBar value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={[5, 10, 25, 50].map((value) => ({ value: String(value), label: String(value) }))} />
      <View className="flex-row flex-wrap items-center gap-3"><Text className="flex-1 font-sans text-xs text-muted">{team?.pagination ? `${team.pagination.total} people / Page ${team.pagination.page} of ${team.pagination.totalPages}` : ''}</Text><ActionChip label="Previous" disabled={!team?.pagination || team.pagination.page <= 1} onPress={() => setPage((value) => value - 1)} /><ActionChip label="Next" disabled={!team?.pagination || team.pagination.page >= team.pagination.totalPages} onPress={() => setPage((value) => value + 1)} /></View>
    </> : tab === 'performance' ? performance.length ? performance.map((row) => <DataCard key={row.key} title={row.label} subtitle={row.subtitle} badge={`${row.score} score`}><StatGrid items={[{ label: 'Tasks', value: row.total }, { label: 'Accepted', value: row.accepted }, { label: 'Overdue', value: row.overdue }]} /><MetricBar label="Completion" value={row.completionRate} /><MetricBar label="On time" value={row.onTimeRate} /></DataCard>) : <EmptyHint title="No performance data" /> : progress.length ? progress.map((item) => <View key={item.taskId} className="gap-3 border-b border-line pb-4"><Text className="font-semibold text-base text-ink">{item.title}</Text><Text className="font-sans text-xs text-muted">{item.department} / {item.stage.replaceAll('_', ' ')}</Text><MetricBar label="Package progress" value={item.progress} /><StatGrid items={[{ label: 'Work items', value: item.totalWorkItems }, { label: 'Submitted', value: item.submittedWorkItems }, { label: 'Accepted', value: item.acceptedWorkItems }]} />{item.workItems.map((work) => <DataCard key={work.taskId} title={work.title} subtitle={work.assignee?.name} badge={work.stage.replaceAll('_', ' ')}><MetricBar label="Progress" value={work.progress} />{work.report ? <Text className="font-sans text-xs leading-5 text-muted">{work.report.summary}</Text> : null}</DataCard>)}</View>) : <EmptyHint title="No hierarchy progress yet" />}
  </FormScrollView>;
}

function ReportTask({ task }: { task: WorkspaceTask }) {
  return <DataCard title={task.title} badge={task.effectiveStatus} subtitle={`Due ${new Date(task.deadline).toLocaleDateString()}${task.completedAt ? ` / Completed ${new Date(task.completedAt).toLocaleDateString()}` : ''}`}><Text className="font-sans text-sm leading-6 text-muted">{task.description}</Text></DataCard>;
}
function MetricBar({ label, value }: { label: string; value: number }) {
  return <View className="gap-2"><View className="flex-row justify-between"><Text className="font-sans text-xs text-muted">{label}</Text><Text className="font-semibold text-xs text-ink">{value}%</Text></View><View className="h-2 overflow-hidden rounded-full bg-line"><View className="h-full bg-success" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></View></View>;
}