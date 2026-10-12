import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/ui/form-scroll-view';
import { Field, IconButton, PageHeader, PrimaryButton, SectionLabel } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar } from '@/components/ui/view-kit';
import { latestEnhancement, taskColumn, taskColumns, type DailyTaskReport, type WorkspaceTask } from '@/features/task-model';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

export function TasksWorkspaceView() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [reports, setReports] = useState<DailyTaskReport[]>([]);
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError('');
      try {
        const [mine, report] = await Promise.all([workspaceService.tasks(), workspaceService.myTaskReport()]);
        if (active) { setTasks(mine.tasks); setReports(report.dailyReports ?? []); }
      } catch (loadError) { if (active) setError(getApiErrorMessage(loadError, 'Tasks could not be loaded.')); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [reload]);
  const filtered = tasks.filter((task) => `${task.title} ${task.description}`.toLowerCase().includes(query.trim().toLowerCase()) && (status === 'all' || (status === 'done' ? task.workflowStage === 'COMPLETED' : task.workflowStage !== 'COMPLETED')));
  const task = tasks.find((item) => item._id === selected);
  const card = (item: WorkspaceTask) => <Pressable key={item._id} accessibilityRole="button" accessibilityLabel={`Open task ${item.title}`} onPress={() => setSelected(item._id)}><DataCard title={item.title} badge={taskColumn(item) ?? item.effectiveStatus} subtitle={`Due ${new Date(item.deadline).toLocaleDateString()}`}>
    {item.productId && typeof item.productId !== 'string' ? <Text className="font-semibold text-xs text-coral">Product: {item.productId.title}{item.productId.deletedAt ? ' (deleted)' : ''}</Text> : null}
    <Text numberOfLines={3} className="font-sans text-xs leading-5 text-muted">{latestEnhancement(item)?.note ?? item.projectObjective ?? 'Workspace task'}</Text>
  </DataCard></Pressable>;

  return <FormScrollView className="bg-canvas" contentContainerClassName="gap-4 px-4 pb-8 pt-4">
    <PageHeader eyebrow="My Workspace" title="My Tasks" description="Personal workspace / Tasks" action={<IconButton icon="refresh" label="Refresh tasks" onPress={() => setReload((value) => value + 1)} />} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerClassName="gap-2">{[{ label: 'Tasks', slug: 'tasks' }, { label: 'Calendar', slug: 'calendar' }, { label: 'Attendance', slug: 'attendance' }, { label: 'Goals & OKRs', slug: 'goals' }, { label: 'Performance', slug: 'performance' }].map((item) => <ActionChip key={item.slug} label={item.label} tone={item.slug === 'tasks' ? 'primary' : 'muted'} onPress={() => router.push({ pathname: '/feature/[slug]', params: { slug: item.slug } })} />)}</ScrollView>
    <Field icon="search-outline" placeholder="Search tasks..." value={query} onChangeText={setQuery} />
    <TabBar value={status} onChange={setStatus} options={[{ value: 'all', label: 'All Status' }, { value: 'done', label: 'Done' }, { value: 'pending', label: 'Pending' }]} />
    <View className="flex-row gap-2"><IconButton icon="grid-outline" label="Board view" onPress={() => setView('board')} /><IconButton icon="list-outline" label="List view" onPress={() => setView('list')} /><Text className="self-center font-medium text-xs text-muted">{view === 'board' ? 'Board' : 'List'}</Text></View>
    {loading ? <Loader /> : error ? <ErrorBanner message={error} onRetry={() => setReload((value) => value + 1)} /> : view === 'board' ? <ScrollView horizontal showsHorizontalScrollIndicator style={{ flexGrow: 0 }} contentContainerClassName="gap-4 pb-2">{taskColumns.map((column) => {
      const columnTasks = filtered.filter((item) => taskColumn(item) === column);
      return <View key={column} style={{ width: width < 768 ? Math.min(280, width - 48) : 260 }} className="gap-3"><Text className="font-semibold text-sm text-ink">{column} <Text className="text-muted">{columnTasks.length}</Text></Text>{columnTasks.length ? columnTasks.map(card) : <View className="rounded-card border border-dashed border-line p-5"><Text className="text-center font-sans text-xs text-muted">No tasks in this stage</Text></View>}</View>;
    })}</ScrollView> : filtered.length ? <View className="gap-3">{filtered.map(card)}</View> : <EmptyHint title="No matching tasks" />}
    <SectionLabel>Task progress</SectionLabel><StatGrid items={[{ label: 'Accepted', value: tasks.filter((item) => item.workflowStage === 'COMPLETED').length }, { label: 'In review', value: tasks.filter((item) => item.workflowStage === 'SUBMITTED').length }, { label: 'Active', value: tasks.filter((item) => item.status === 'PENDING').length }]} />
    <Modal animationType="slide" visible={Boolean(task)} onRequestClose={() => setSelected(undefined)}>{task ? <TaskDetails key={task._id} task={task} report={reports.find((item) => item.taskId === task._id)} onClose={() => setSelected(undefined)} onUpdated={(updated) => setTasks((current) => current.map((item) => item._id === updated._id ? updated : item))} onReported={(nextReport) => setReports((current) => [nextReport, ...current.filter((item) => item._id !== nextReport._id)])} /> : null}</Modal>
  </FormScrollView>;
}

function TaskDetails({ task, report, onClose, onUpdated, onReported }: { task: WorkspaceTask; report?: DailyTaskReport; onClose: () => void; onUpdated: (task: WorkspaceTask) => void; onReported: (report: DailyTaskReport) => void }) {
  const [description, setDescription] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [summary, setSummary] = useState(report?.summary ?? '');
  const [progress, setProgress] = useState(String(report?.progress ?? 0));
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [error, setError] = useState('');
  const reportable = task.status === 'PENDING' && task.workflowStage === 'ASSIGNED';
  const enhancement = latestEnhancement(task);
  const submit = async () => {
    if (!reportable || description.trim().length < 20) return;
    for (const url of [githubUrl, liveUrl].filter(Boolean)) {
      try { if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error(); }
      catch { setError('Enter valid HTTP or HTTPS delivery URLs.'); return; }
    }
    setBusy(true); setError('');
    try { const result = await workspaceService.submitTask(task._id, description.trim(), { githubUrl: githubUrl.trim() || undefined, liveUrl: liveUrl.trim() || undefined }); onUpdated(result.task); }
    catch (submitError) { setError(getApiErrorMessage(submitError, 'Work could not be submitted.')); }
    finally { setBusy(false); }
  };
  const shareReport = async () => {
    const percent = Number(progress);
    if (!reportable || summary.trim().length < 2 || !Number.isFinite(percent) || percent < 0 || percent > 100) { setError('Add a summary and progress from 0 to 100.'); return; }
    setReportBusy(true); setError('');
    try { const result = await workspaceService.submitDailyReport({ taskId: task._id, summary: summary.trim(), progress: percent }); onReported(result.report as DailyTaskReport); }
    catch (reportError) { setError(getApiErrorMessage(reportError, 'The report could not be saved.')); }
    finally { setReportBusy(false); }
  };
  return <SafeAreaView className="flex-1 bg-white"><FormScrollView contentContainerClassName="gap-4 p-5"><PageHeader eyebrow={`Task ${task._id.slice(-5)}`} title={task.title} action={<IconButton icon="close" label="Close task" onPress={onClose} />} />
    <Text className="font-semibold text-xs text-coral">{taskColumn(task) ?? task.workflowStage}</Text>
    {enhancement && task.status === 'PENDING' ? <View className="gap-2 border-l-4 border-amber-400 bg-amber-50 p-4"><Text className="font-semibold text-sm text-ink">Enhancement requested</Text><Text className="font-sans text-sm leading-6 text-muted">{enhancement.note}</Text></View> : null}
    <Text className="font-sans text-xs text-muted">Due {new Date(task.deadline).toLocaleString()}</Text><SectionLabel>Description</SectionLabel><Text className="font-sans text-sm leading-6 text-muted">{task.description}</Text>
    {task.projectObjective ? <><SectionLabel>Project objective</SectionLabel><Text className="font-sans text-sm leading-6 text-muted">{task.projectObjective}</Text></> : null}
    {[{ label: 'Recommended stack', values: task.recommendedStack }, { label: 'Requirements', values: task.requirements }, { label: 'Final deliverables', values: task.finalDeliverables }].map((section) => section.values?.length ? <View key={section.label} className="gap-2"><SectionLabel>{section.label}</SectionLabel>{section.values.map((value, index) => <Text key={`${value}-${index}`} className="font-sans text-sm leading-6 text-muted">{index + 1}. {value}</Text>)}</View> : null)}
    {task.learningResources?.map((url) => <Pressable key={url} onPress={() => { void Linking.openURL(url); }}><Text className="font-sans text-sm leading-6 text-coral">{url}</Text></Pressable>)}
    {task.submission ? <View className="gap-3 border-l-4 border-success bg-emerald-50 p-4"><Text className="font-semibold text-sm text-ink">Submitted delivery</Text><Text className="font-sans text-sm leading-6 text-muted">{task.submission.description}</Text>{task.submission.githubUrl ? <ActionChip label="Repository" onPress={() => { void Linking.openURL(task.submission!.githubUrl!); }} /> : null}{task.submission.liveUrl ? <ActionChip label="Live app" onPress={() => { void Linking.openURL(task.submission!.liveUrl!); }} /> : null}</View> : null}
    {reportable ? <><SectionLabel>Progress report</SectionLabel><View className="flex-row items-center gap-2"><IconButton icon="remove" label="Decrease progress" onPress={() => setProgress(String(Math.max(0, Number(progress) - 5)))} /><View className="flex-1"><Field keyboardType="number-pad" placeholder="Progress %" value={progress} onChangeText={setProgress} /></View><IconButton icon="add" label="Increase progress" onPress={() => setProgress(String(Math.min(100, Number(progress) + 5)))} /></View><Field multiline placeholder="Describe completed work, blockers, and your next step." value={summary} onChangeText={setSummary} /><PrimaryButton label={report ? 'Update progress report' : 'Share progress report'} busy={reportBusy} disabled={summary.trim().length < 2} tone="ink" onPress={() => void shareReport()} />
      <SectionLabel>What did you build?</SectionLabel><Field multiline placeholder="Describe the implementation and what your manager should verify." value={description} onChangeText={setDescription} /><Text className="font-sans text-xs text-muted">{description.trim().length}/20 minimum characters</Text><Field icon="logo-github" placeholder="https://github.com/..." keyboardType="url" autoCapitalize="none" value={githubUrl} onChangeText={setGithubUrl} /><Field icon="open-outline" placeholder="https://your-app.com" keyboardType="url" autoCapitalize="none" value={liveUrl} onChangeText={setLiveUrl} />
    </> : null}
    {error ? <ErrorBanner message={error} /> : null}<PrimaryButton icon="checkmark" label={task.workflowStage === 'COMPLETED' ? 'Accepted by CEO' : task.workflowStage === 'SUBMITTED' ? 'Submitted for review' : enhancement ? 'Resubmit enhancement' : 'Submit for manager review'} busy={busy} disabled={!reportable || description.trim().length < 20} onPress={() => void submit()} />
  </FormScrollView></SafeAreaView>;
}