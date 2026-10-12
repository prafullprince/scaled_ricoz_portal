import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { EmptyHint, ErrorBanner, Loader, StatGrid } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type GoalTask = { _id?: string; id?: string; title?: string; status?: string; deadline?: string; progress?: number };

const tasksOf = (payload: unknown): GoalTask[] => {
  if (Array.isArray(payload)) return payload as GoalTask[];
  if (payload && typeof payload === 'object') {
    const value = (payload as Record<string, unknown>).tasks;
    if (Array.isArray(value)) return value as GoalTask[];
  }
  return [];
};

const progressOf = (task: GoalTask) => {
  if (typeof task.progress === 'number') return Math.max(0, Math.min(100, task.progress));
  if (task.status === 'DONE') return 100;
  if (task.status === 'IN_PROGRESS' || task.status === 'REVIEW') return 55;
  return 20;
};

export function GoalsView() {
  const [tasks, setTasks] = useState<GoalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    workspaceService
      .tasks()
      .then((payload) => active && setTasks(tasksOf(payload)))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Your goals could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadKey]);

  const done = tasks.filter((task) => task.status === 'DONE').length;
  const overdue = tasks.filter((task) => task.status !== 'DONE' && task.deadline && new Date(task.deadline) < new Date()).length;
  const alignment = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="Growth" title="Goals & OKRs" description="Objective progress derived from your current assignments." />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          <StatGrid items={[
            { label: 'On track', value: done },
            { label: 'In progress', value: tasks.length - done - overdue },
            { label: 'Behind', value: overdue },
            { label: 'Goal alignment', value: `${alignment}%` },
          ]} />
          {tasks.length ? (
            <View className="gap-2.5">
              {tasks.map((task, index) => {
                const progress = progressOf(task);
                const status = task.status === 'DONE' ? 'on track' : progress < 40 ? 'at risk' : 'in progress';
                return (
                  <View key={task._id ?? task.id ?? index} className="gap-2 rounded-card border border-line bg-white p-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="flex-1 font-bold text-[15px] text-ink">{task.title ?? `Goal ${index + 1}`}</Text>
                      <Text className={`font-extra text-[11px] ${task.status === 'DONE' ? 'text-success' : progress < 40 ? 'text-warning' : 'text-teal'}`}>{status}</Text>
                    </View>
                    <Text className="font-sans text-xs text-muted">
                      {task.deadline ? `Due ${new Date(task.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ` : ''}{progress}%
                    </Text>
                    <View className="h-2 overflow-hidden rounded-full bg-paper">
                      <View className="h-full rounded-full bg-success" style={{ width: `${progress}%` }} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyHint icon="flag-outline" title="No goals yet" description="Goals appear as soon as assignments are shared with your account." />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
