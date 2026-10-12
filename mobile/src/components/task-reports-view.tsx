import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader, SectionLabel } from '@/components/ui/primitives';
import { DataCard, EmptyHint, ErrorBanner, Loader, TabBar, extractRecords, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type Mode = 'mine' | 'team';
type Option = { _id?: string; id?: string; title?: string };

const optionsOf = (payload: unknown): Option[] => {
  if (Array.isArray(payload)) return payload as Option[];
  if (payload && typeof payload === 'object') {
    const value = (payload as Record<string, unknown>).tasks;
    if (Array.isArray(value)) return value as Option[];
  }
  return [];
};

function RecordList({ data, emptyTitle }: { data: unknown; emptyTitle: string }) {
  const records = extractRecords(data);
  if (!records.length) return <EmptyHint icon="stats-chart-outline" title={emptyTitle} description="Reports appear once your team logs progress." />;
  return (
    <View className="gap-2.5">
      {records.map((record, index) => (
        <DataCard key={toId(record, index)} title={recordTitle(record, index)} badge={typeof record.status === 'string' ? record.status : undefined}>
          <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 5)}</Text>
        </DataCard>
      ))}
    </View>
  );
}

export function TaskReportsView({ mode }: { mode: Mode }) {
  const [tab, setTab] = useState<string>(mode === 'mine' ? 'report' : 'team');
  const [report, setReport] = useState<unknown>(null);
  const [performance, setPerformance] = useState<unknown>(null);
  const [progress, setProgress] = useState<unknown>(null);
  const [tasks, setTasks] = useState<Option[]>([]);
  const [taskId, setTaskId] = useState('');
  const [summary, setSummary] = useState('');
  const [percent, setPercent] = useState('50');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    const load = async () => {
      if (mode === 'mine') {
        const [nextReport, nextTasks] = await Promise.all([workspaceService.myTaskReport(), workspaceService.tasks()]);
        if (!active) return;
        setReport(nextReport);
        setTasks(optionsOf(nextTasks));
        return;
      }
      const [nextReport, nextPerformance, nextProgress] = await Promise.all([
        workspaceService.adminTaskReport(),
        workspaceService.workflowPerformance(),
        workspaceService.workflowProgress(),
      ]);
      if (!active) return;
      setReport(nextReport);
      setPerformance(nextPerformance);
      setProgress(nextProgress);
    };
    void load()
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Task reports could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [mode, reloadKey]);

  const submitDailyReport = async () => {
    const progressValue = Number(percent);
    if (!taskId) { Alert.alert('Daily report', 'Choose the task this report belongs to.'); return; }
    if (summary.trim().length < 5 || Number.isNaN(progressValue) || progressValue < 0 || progressValue > 100) {
      Alert.alert('Daily report', 'Write a short summary and pick progress between 0 and 100.');
      return;
    }
    setBusy(true);
    try {
      await workspaceService.submitDailyReport({ taskId, summary: summary.trim(), progress: progressValue });
      setSummary('');
      setReloadKey((value) => value + 1);
      Alert.alert('Daily report', 'Your report was submitted.');
    } catch (loadError) {
      Alert.alert('Daily report', getApiErrorMessage(loadError, 'Unable to submit the report.'));
    } finally {
      setBusy(false);
    }
  };

  const options = mode === 'mine'
    ? [{ value: 'report', label: 'MY REPORT' }, { value: 'submit', label: 'NEW ENTRY' }]
    : [{ value: 'team', label: 'TEAM REPORT' }, { value: 'performance', label: 'PERFORMANCE' }, { value: 'progress', label: 'PROGRESS' }];

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader
        eyebrow={mode === 'mine' ? 'Growth' : 'Task management'}
        title="Task reports"
        description={mode === 'mine' ? 'Track the progress you have logged against every assignment.' : 'Hierarchy performance and delivery progress across your teams.'}
      />
      <TabBar onChange={setTab} options={options} value={tab} />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          {mode === 'mine' && tab === 'report' ? <RecordList data={report} emptyTitle="No reports yet" /> : null}
          {mode === 'mine' && tab === 'submit' ? (
            <View className="gap-3 rounded-card border border-line bg-white p-4">
              <SectionLabel>New daily report</SectionLabel>
              <View className="gap-2">
                {tasks.map((task) => {
                  const title = task.title ?? 'Task';
                  const id = String(task._id ?? task.id ?? title);
                  const active = taskId === id;
                  return (
                    <Pressable key={id} className={`flex-row items-center gap-2 rounded-card border px-3 py-2.5 ${active ? 'border-ink bg-mint' : 'border-line bg-white'}`} onPress={() => setTaskId(id)}>
                      <View className={`h-3 w-3 rounded-full ${active ? 'bg-success' : 'bg-line'}`} />
                      <Text numberOfLines={1} className="flex-1 font-sans text-[13px] text-ink">{title}</Text>
                    </Pressable>
                  );
                })}
                {!tasks.length ? <Text className="font-sans text-[13px] text-muted">No open tasks are assigned to you.</Text> : null}
              </View>
              <TextInput
                className="min-h-24 rounded-card border border-line bg-white px-4 py-3 font-medium text-[14px] text-ink"
                multiline
                onChangeText={setSummary}
                placeholder="What did you work on today?"
                placeholderTextColor={colors.muted}
                textAlignVertical="top"
                value={summary}
              />
              <TextInput
                className="min-h-12 rounded-card border border-line bg-white px-4 font-medium text-[15px] text-ink"
                keyboardType="numeric"
                onChangeText={setPercent}
                placeholder="Progress %"
                placeholderTextColor={colors.muted}
                value={percent}
              />
              <Pressable className={`h-12 items-center justify-center rounded-card bg-ink ${busy ? 'opacity-60' : ''}`} disabled={busy} onPress={submitDailyReport}>
                <Text className="font-bold text-[14px] text-white">{busy ? 'Submitting…' : 'Submit report'}</Text>
              </Pressable>
            </View>
          ) : null}
          {mode === 'team' && tab === 'team' ? <RecordList data={report} emptyTitle="No team reports yet" /> : null}
          {mode === 'team' && tab === 'performance' ? <RecordList data={performance} emptyTitle="Performance data unavailable" /> : null}
          {mode === 'team' && tab === 'progress' ? <RecordList data={progress} emptyTitle="Progress data unavailable" /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}
