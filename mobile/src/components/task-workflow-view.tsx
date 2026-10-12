import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { colors, spacing } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';
import { useAppSelector } from '@/store/hooks';

type WorkflowTask = {
  _id: string;
  title: string;
  description?: string;
  deadline?: string;
  department?: string;
  workflowStage: string;
  currentOwner?: { _id: string; name: string } | string | null;
};

const departments = ['PRODUCT', 'MARKETING', 'FINANCE', 'SALES', 'PROJECTS', 'SUPPORT', 'HR', 'DESIGN', 'ENGINEERING'];
const reviewStages = new Set(['MANAGER_REVIEW', 'HEAD_REVIEW', 'ADMIN_FINAL_REVIEW', 'CEO_REVIEW']);

export function TaskWorkflowView({ department: lockedDepartment }: { department?: string } = {}) {
  const roles = useAppSelector((state) => state.auth.user?.roles ?? []);
  const userId = useAppSelector((state) => state.auth.user?.user_id);
  const isAdmin = roles.includes('ADMIN');
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [selected, setSelected] = useState<WorkflowTask | null>(null);
  const [department, setDepartment] = useState('PRODUCT');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await workspaceService.workflowTasks(lockedDepartment) as { tasks?: WorkflowTask[] };
      setTasks(result.tasks ?? []);
    } catch (error) { Alert.alert('Task workflow', getApiErrorMessage(error, 'Unable to load the workflow queue.')); }
  }, [lockedDepartment]);
  useEffect(() => { void Promise.resolve().then(load).catch(() => undefined); }, [load]);

  const route = async () => {
    if (!selected) return;
    setBusy(true);
    try { await workspaceService.routeWorkflowToHead(selected._id, department, note.trim() || undefined); setSelected(null); setNote(''); await load(); }
    catch (error) { Alert.alert('Route task', getApiErrorMessage(error, 'Unable to route this task.')); }
    finally { setBusy(false); }
  };

  const review = async (decision: 'APPROVE' | 'ENHANCEMENT') => {
    if (!selected || (decision === 'ENHANCEMENT' && note.trim().length < 2)) { Alert.alert('Review', 'Add a note describing the required enhancement.'); return; }
    setBusy(true);
    try { await workspaceService.reviewWorkflow(selected._id, decision, note.trim() || undefined); setSelected(null); setNote(''); await load(); }
    catch (error) { Alert.alert('Review task', getApiErrorMessage(error, 'Unable to review this task.')); }
    finally { setBusy(false); }
  };

  const ownsSelected = selected && (typeof selected.currentOwner === 'string' ? selected.currentOwner === userId : selected.currentOwner?._id === userId);
  const canRoute = isAdmin && selected?.workflowStage === 'ADMIN_REVIEW';
  const canReview = selected && reviewStages.has(selected.workflowStage) && ownsSelected;

  return (
    <ScrollView className="bg-canvas" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Delivery pipeline" title="Task workflow" description="Route briefs and move approved work through the organization." />
      {tasks.map((task) => <Pressable key={task._id} onPress={() => { setSelected(task); setDepartment(task.department ?? 'PRODUCT'); setNote(''); }} style={[styles.card, selected?._id === task._id && styles.selected]}><View style={styles.copy}><Text style={styles.cardTitle}>{task.title}</Text><Text numberOfLines={2} style={styles.body}>{task.description}</Text><Text style={styles.meta}>{task.department ?? 'Unassigned'}{task.deadline ? ` · Due ${new Date(task.deadline).toLocaleDateString()}` : ''}</Text></View><Text style={styles.stage}>{task.workflowStage.replaceAll('_', ' ')}</Text></Pressable>)}
      {!tasks.length ? <Text style={styles.empty}>No workflow tasks are visible to this role.</Text> : null}
      {selected ? <View style={styles.actionBox}><Text style={styles.actionTitle}>{selected.title}</Text>{canRoute ? <><Text style={styles.label}>Route to department head</Text><View style={styles.wrap}>{departments.map((item) => <Pressable key={item} onPress={() => setDepartment(item)} style={[styles.choice, department === item && styles.choiceActive]}><Text style={[styles.choiceText, department === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}</View></> : null}<TextInput multiline onChangeText={setNote} placeholder={canReview ? 'Review note' : 'Routing note (optional)'} placeholderTextColor={colors.muted} style={styles.input} value={note} />{canRoute ? <Pressable disabled={busy} onPress={route} style={styles.primary}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Route to head</Text>}</Pressable> : null}{canReview ? <View style={styles.actions}><Pressable disabled={busy} onPress={() => review('ENHANCEMENT')} style={styles.secondary}><Text style={styles.secondaryText}>Request changes</Text></Pressable><Pressable disabled={busy} onPress={() => review('APPROVE')} style={[styles.primary, styles.flex]}><Text style={styles.primaryText}>Approve</Text></Pressable></View> : null}{!canRoute && !canReview ? <Text style={styles.help}>This stage has no mobile action for your role yet.</Text> : null}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48, gap: 10 }, kicker: { color: colors.brand, fontSize: 12, fontWeight: '800' }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginBottom: spacing.md }, card: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface }, selected: { borderColor: colors.brand, borderWidth: 2 }, copy: { flex: 1, gap: 4 }, cardTitle: { color: colors.ink, fontWeight: '800' }, body: { color: colors.muted, lineHeight: 18 }, meta: { color: colors.muted, fontSize: 11 }, stage: { maxWidth: '32%', color: colors.teal, fontSize: 9, fontWeight: '900', textAlign: 'right' }, empty: { color: colors.muted, padding: spacing.xl, textAlign: 'center' },
  actionBox: { gap: 10, paddingTop: spacing.lg }, actionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' }, label: { color: colors.ink, fontWeight: '800' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 5, backgroundColor: colors.surface }, choiceActive: { borderColor: colors.teal, backgroundColor: colors.teal }, choiceText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, choiceTextActive: { color: colors.white }, input: { minHeight: 88, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 6, color: colors.ink, backgroundColor: colors.surface, textAlignVertical: 'top' }, actions: { flexDirection: 'row', gap: 10 }, flex: { flex: 1 }, primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 6, backgroundColor: colors.brand }, primaryText: { color: colors.white, fontWeight: '800' }, secondary: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.danger, borderRadius: 6 }, secondaryText: { color: colors.danger, fontWeight: '800' }, help: { color: colors.muted, lineHeight: 20 },
});
