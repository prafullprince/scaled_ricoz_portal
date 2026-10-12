import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PageHeader } from '@/components/ui/primitives';
import { DataCard, EmptyHint, ErrorBanner, Loader } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type CalendarEvent = { date: string; title: string; kind: 'task' | 'leave' };

const iso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const daysInMonth = (cursor: Date) => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
const startOffset = (cursor: Date) => new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
const monthLabel = (cursor: Date) => cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export function CalendarView() {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => iso(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    Promise.all([workspaceService.tasks(), workspaceService.leave()])
      .then(([tasksPayload, leavePayload]) => {
        if (!active) return;
        const next: CalendarEvent[] = [];
        const taskList = Array.isArray(tasksPayload) ? tasksPayload : ((tasksPayload as Record<string, unknown>)?.tasks ?? []);
        if (Array.isArray(taskList)) {
          for (const item of taskList) {
            const task = item as Record<string, unknown>;
            const deadline = typeof task.deadline === 'string' ? task.deadline.slice(0, 10) : '';
            if (deadline) next.push({ date: deadline, title: String(task.title ?? 'Task due'), kind: 'task' });
          }
        }
        const requests = (leavePayload as { leave?: { requests?: Record<string, unknown>[] } })?.leave?.requests ?? [];
        for (const request of requests) {
          const start = String(request.startDate ?? '').slice(0, 10);
          const end = String(request.endDate ?? '').slice(0, 10);
          if (!start || !end) continue;
          const first = new Date(`${start}T00:00:00`);
          const last = new Date(`${end}T00:00:00`);
          let guard = 0;
          const dayCursor = new Date(first);
          while (dayCursor <= last && guard < 62) {
            next.push({ date: iso(dayCursor), title: `${request.type ?? 'Leave'} (${request.status ?? 'requested'})`, kind: 'leave' });
            dayCursor.setDate(dayCursor.getDate() + 1);
            guard += 1;
          }
        }
        setEvents(next);
      })
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Your calendar could not be loaded.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [reloadKey]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);


  const shiftMonth = (delta: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const dayEvents = byDate.get(selected) ?? [];

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="My time" title="Calendar" description="Task deadlines and time off, month by month." />
      {loading ? <Loader /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          <View className="rounded-card border border-line bg-white p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Pressable className="h-9 w-9 items-center justify-center rounded-card bg-paper active:opacity-70" onPress={() => shiftMonth(-1)}>
                <Text className="font-bold text-ink">‹</Text>
              </Pressable>
              <Text className="font-bold text-[15px] text-ink">{monthLabel(cursor)}</Text>
              <Pressable className="h-9 w-9 items-center justify-center rounded-card bg-paper active:opacity-70" onPress={() => shiftMonth(1)}>
                <Text className="font-bold text-ink">›</Text>
              </Pressable>
            </View>
            <View className="flex-row">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
                <View key={`${label}-${index}`} className="w-[14.28%] items-center pb-1">
                  <Text className="font-extra text-[10px] text-muted">{label}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {Array.from({ length: startOffset(cursor) }).map((_, index) => (
                <View key={`blank-${index}`} className="w-[14.28%] items-center justify-center py-1" />
              ))}
              {Array.from({ length: daysInMonth(cursor) }).map((_, index) => {
                const day = index + 1;
                const date = iso(new Date(cursor.getFullYear(), cursor.getMonth(), day));
                const hasEvents = Boolean(byDate.get(date)?.length);
                const isSelected = selected === date;
                const isToday = date === iso(new Date());
                return (
                  <Pressable key={date} className="w-[14.28%] items-center justify-center py-1" onPress={() => setSelected(date)}>
                    <View className={`h-8 w-8 items-center justify-center rounded-full ${isSelected ? 'bg-ink' : isToday ? 'bg-mint' : ''}`}>
                      <Text className={`font-bold text-[13px] ${isSelected ? 'text-white' : 'text-ink'}`}>{day}</Text>
                    </View>
                    <View className={`mt-0.5 h-1.5 w-1.5 rounded-full ${hasEvents ? (isSelected ? 'bg-coral' : 'bg-teal') : 'bg-transparent'}`} />
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text className="font-bold text-base text-ink">
            {new Date(`${selected}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          {dayEvents.length ? (
            <View className="gap-2.5">
              {dayEvents.map((event, index) => (
                <DataCard key={`${event.date}-${index}`} title={event.title} badge={event.kind === 'leave' ? 'leave' : 'deadline'} subtitle={event.date}>
                  <View className="h-1 w-full rounded" style={{ backgroundColor: event.kind === 'leave' ? colors.brand : colors.teal }} />
                </DataCard>
              ))}
            </View>
          ) : (
            <EmptyHint icon="calendar-outline" title="Nothing scheduled" description="No task deadlines or leave on this day." />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}
