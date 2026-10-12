import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { colors, spacing } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type Task = { _id: string; title: string; description?: string; deadline?: string; status?: string; effectiveStatus?: string; workflowStage?: string };

const isActiveAssignedWork = (task: Task) => task.status === 'PENDING' && task.workflowStage === 'ASSIGNED';

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState('');
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedTask = tasks.find((task) => task._id === selected);

  const load = async () => {
    const payload = await workspaceService.tasks() as { tasks?: Task[] };
    setTasks(payload.tasks ?? []);
  };
  useEffect(() => { void Promise.resolve().then(load).catch((error) => Alert.alert('Tasks', getApiErrorMessage(error, 'Unable to load tasks.'))); }, []);

  const submitReport = async () => {
    const value = Number(progress);
    if (!selected || report.trim().length < 2 || !Number.isFinite(value) || value < 0 || value > 100) {
      Alert.alert('Daily report', 'Select a task, add a summary, and enter progress from 0 to 100.'); return;
    }
    setBusy(true);
    try { await workspaceService.submitDailyReport({ taskId: selected, summary: report.trim(), progress: value }); setReport(''); setProgress(''); Alert.alert('Daily report', 'Report submitted.'); }
    catch (error) { Alert.alert('Daily report', getApiErrorMessage(error, 'Unable to submit report.')); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Delivery" title="My tasks" description="Review assignments and record today’s progress." />
      {tasks.map((task) => { const reportable = isActiveAssignedWork(task); return <Pressable key={task._id} disabled={!reportable} onPress={() => setSelected(task._id)} style={[styles.card, selected === task._id && styles.selected, !reportable && styles.inactive]}><View style={styles.cardCopy}><Text style={styles.cardTitle}>{task.title}</Text><Text numberOfLines={2} style={styles.cardText}>{task.description}</Text></View><Text style={styles.status}>{reportable ? 'ACTIVE' : task.effectiveStatus ?? task.status}</Text></Pressable>; })}
      {!tasks.length ? <Text style={styles.empty}>No assigned tasks.</Text> : null}
      {selectedTask && isActiveAssignedWork(selectedTask) ? <View style={styles.reportBox}><Text style={styles.reportTitle}>Daily progress</Text><TextInput multiline onChangeText={setReport} placeholder="What changed today?" placeholderTextColor={colors.muted} style={[styles.input, styles.reportInput]} value={report} /><TextInput keyboardType="number-pad" onChangeText={setProgress} placeholder="Progress %" placeholderTextColor={colors.muted} style={styles.input} value={progress} /><Pressable disabled={busy} onPress={submitReport} style={styles.button}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Submit report</Text>}</Pressable></View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48, gap: 10 }, kicker: { color: colors.brand, fontSize: 12, fontWeight: '800' }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginBottom: spacing.md },
  card: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, selected: { borderColor: colors.brand, borderWidth: 2 }, inactive: { opacity: 0.55 }, cardCopy: { flex: 1, gap: 4 }, cardTitle: { color: colors.ink, fontWeight: '800' }, cardText: { color: colors.muted, lineHeight: 18 }, status: { color: colors.teal, fontSize: 10, fontWeight: '900' }, empty: { color: colors.muted, textAlign: 'center', marginVertical: spacing.xl },
  reportBox: { gap: 10, paddingTop: spacing.lg }, reportTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, input: { minHeight: 48, paddingHorizontal: spacing.md, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }, reportInput: { minHeight: 88, paddingTop: 13, textAlignVertical: 'top' }, button: { height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.brand }, buttonText: { color: colors.white, fontWeight: '800' },
});