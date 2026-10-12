import { useEffect, useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/ui/form-scroll-view';
import { Field, IconButton, PageHeader, PrimaryButton, SectionLabel } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar } from '@/components/ui/view-kit';
import type { WorkspaceTask } from '@/features/task-model';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';
import { useAppSelector } from '@/store/hooks';

const departments = ['PRODUCT', 'MARKETING', 'FINANCE', 'SALES', 'PROJECTS', 'SUPPORT', 'HR', 'DESIGN', 'ENGINEERING'];
const reviewStages = ['MANAGER_REVIEW', 'HEAD_REVIEW', 'ADMIN_FINAL_REVIEW', 'CEO_REVIEW'];
const deliveryStages = ['DELEGATED', 'ASSIGNED', 'SUBMITTED'];
const stageLabels: Record<string, string> = { ADMIN_REVIEW: 'Admin triage', HEAD_PLANNING: 'Department planning', MANAGER_PLANNING: 'Work breakdown', DELEGATED: 'In delivery', ASSIGNED: 'Assigned', SUBMITTED: 'Submitted', MANAGER_REVIEW: 'Manager review', HEAD_REVIEW: 'Head review', ADMIN_FINAL_REVIEW: 'Admin review', CEO_REVIEW: 'CEO approval', COMPLETED: 'Completed' };
const personId = (person: WorkspaceTask['currentOwner']) => typeof person === 'string' ? person : person?._id;
const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
type WorkItem = { title: string; description: string; deadline: string; assignedToIds: string[] };

export function TaskWorkflowView({ department }: { department?: string } = {}) {
  const user = useAppSelector((state) => state.auth.user);
  const roles = user?.roles ?? [];
  const admin = roles.includes('ADMIN');
  const executive = admin || roles.includes('CEO');
  const head = roles.some((role) => role === 'HEAD' || role.endsWith('_HEAD'));
  const manager = roles.some((role) => role === 'MANAGER' || role.endsWith('_MANAGER'));
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [subtasks, setSubtasks] = useState<WorkspaceTask[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selected, setSelected] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const owns = (task: WorkspaceTask) => executive || personId(task.currentOwner) === user?.user_id;
  const canAct = (task: WorkspaceTask) => (admin && task.workflowStage === 'ADMIN_REVIEW') || (owns(task) && ((head && ['HEAD_PLANNING', 'HEAD_REVIEW'].includes(task.workflowStage ?? '')) || (manager && ['MANAGER_PLANNING', 'DELEGATED', 'MANAGER_REVIEW'].includes(task.workflowStage ?? '')) || (admin && task.workflowStage === 'ADMIN_FINAL_REVIEW') || (executive && task.workflowStage === 'CEO_REVIEW')));
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError('');
      try { const result = await workspaceService.workflowTasks(department) as { tasks: WorkspaceTask[]; subtasks: WorkspaceTask[] }; if (active) { setTasks(result.tasks); setSubtasks(result.subtasks); } }
      catch (loadError) { if (active) setError(getApiErrorMessage(loadError, 'The workflow queue could not be loaded.')); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [department, reload]);
  const task = tasks.find((item) => item._id === selected);
  const filtered = tasks.filter((item) => `${item.title} ${item.description} ${item.department ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'ALL' || (filter === 'ACTION' && canAct(item)) || (filter === 'DELIVERY' && deliveryStages.includes(item.workflowStage ?? '')) || (filter === 'REVIEW' && reviewStages.includes(item.workflowStage ?? '')) || (filter === 'COMPLETED' && item.workflowStage === 'COMPLETED')));
  return <FormScrollView className="bg-canvas" contentContainerClassName="gap-4 px-4 pb-8 pt-4"><PageHeader eyebrow="Leadership workspace" title={department ? `${department.charAt(0)}${department.slice(1).toLowerCase()} task operations` : 'Task operations'} action={<IconButton icon="refresh" label="Refresh workflow" onPress={() => setReload((value) => value + 1)} />} />
    {executive ? <ActionChip label="New brief" tone="primary" onPress={() => setCreating(true)} /> : null}
    <StatGrid items={[{ label: 'Needs your action', value: tasks.filter(canAct).length }, { label: 'In delivery', value: tasks.filter((item) => deliveryStages.includes(item.workflowStage ?? '')).length }, { label: 'In review', value: tasks.filter((item) => reviewStages.includes(item.workflowStage ?? '')).length }, { label: 'Completed', value: tasks.filter((item) => item.workflowStage === 'COMPLETED').length }]} />
    <Field icon="search-outline" placeholder="Search tasks or departments" value={query} onChangeText={setQuery} /><TabBar value={filter} onChange={setFilter} options={[{ value: 'ALL', label: 'All tasks' }, { value: 'ACTION', label: 'Needs action' }, { value: 'DELIVERY', label: 'Delivery' }, { value: 'REVIEW', label: 'Review' }, { value: 'COMPLETED', label: 'Completed' }]} />
    {loading ? <Loader /> : error ? <ErrorBanner message={error} onRetry={() => setReload((value) => value + 1)} /> : filtered.length ? filtered.map((item) => <DataCard key={item._id} title={item.title} badge={stageLabels[item.workflowStage ?? ''] ?? item.workflowStage} subtitle={`${item.department ?? 'Unassigned'} / Due ${new Date(item.deadline).toLocaleDateString()}`} actions={<ActionChip label={canAct(item) ? 'Open action panel' : 'View details'} tone={canAct(item) ? 'primary' : 'muted'} onPress={() => setSelected(item._id)} />}><Text className="font-sans text-sm leading-6 text-muted">{item.description}</Text>{item.currentOwner && typeof item.currentOwner !== 'string' ? <Text className="font-sans text-xs text-muted">Current owner: {item.currentOwner.name}</Text> : null}</DataCard>) : <EmptyHint title="No matching workflow tasks" />}
    <Modal animationType="slide" visible={creating} onRequestClose={() => setCreating(false)}>{creating ? <NewBrief department={department} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setReload((value) => value + 1); }} /> : null}</Modal>
    <Modal animationType="slide" visible={Boolean(task)} onRequestClose={() => setSelected(undefined)}>{task ? <WorkflowPanel key={task._id} task={task} childrenTasks={subtasks.filter((item) => item.parentTaskId === task._id)} canRoute={admin && task.workflowStage === 'ADMIN_REVIEW'} canPlan={head && owns(task) && task.workflowStage === 'HEAD_PLANNING'} canDelegate={manager && owns(task) && ['MANAGER_PLANNING', 'DELEGATED'].includes(task.workflowStage ?? '')} canReview={owns(task) && ((manager && task.workflowStage === 'MANAGER_REVIEW') || (head && task.workflowStage === 'HEAD_REVIEW') || (admin && task.workflowStage === 'ADMIN_FINAL_REVIEW') || (executive && task.workflowStage === 'CEO_REVIEW'))} onClose={() => setSelected(undefined)} onUpdated={() => { setSelected(undefined); setReload((value) => value + 1); }} /> : null}</Modal>
  </FormScrollView>;
}

function NewBrief({ department, onClose, onCreated }: { department?: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (title.trim().length < 3 || description.trim().length < 20 || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) { setError('Enter a title, at least 20 description characters, and a YYYY-MM-DD deadline.'); return; }
    setBusy(true); setError('');
    try { await workspaceService.createWorkflowTask({ title: title.trim(), description: description.trim(), deadline, department }); onCreated(); }
    catch (saveError) { setError(getApiErrorMessage(saveError, 'The brief could not be created.')); }
    finally { setBusy(false); }
  };
  return <SafeAreaView className="flex-1 bg-white"><FormScrollView contentContainerClassName="gap-4 p-5"><PageHeader eyebrow="Task operations" title="New brief" action={<IconButton icon="close" label="Close brief" onPress={onClose} />} /><Field placeholder="Title" value={title} onChangeText={setTitle} /><Field multiline placeholder="Describe the project brief" value={description} onChangeText={setDescription} /><Field placeholder="Deadline YYYY-MM-DD" value={deadline} onChangeText={setDeadline} />{error ? <ErrorBanner message={error} /> : null}<PrimaryButton label="Create brief" busy={busy} onPress={() => void submit()} /></FormScrollView></SafeAreaView>;
}

function WorkflowPanel({ task, childrenTasks, canRoute, canPlan, canDelegate, canReview, onClose, onUpdated }: { task: WorkspaceTask; childrenTasks: WorkspaceTask[]; canRoute: boolean; canPlan: boolean; canDelegate: boolean; canReview: boolean; onClose: () => void; onUpdated: () => void }) {
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof workspaceService.workflowCandidates>>>([]);
  const [department, setDepartment] = useState(task.department ?? 'PRODUCT');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [subtaskId, setSubtaskId] = useState('');
  const [objective, setObjective] = useState(task.projectObjective ?? '');
  const [stack, setStack] = useState((task.recommendedStack ?? []).join('\n'));
  const [requirements, setRequirements] = useState((task.requirements ?? []).join('\n'));
  const [deliverables, setDeliverables] = useState((task.finalDeliverables ?? []).join('\n'));
  const [resources, setResources] = useState((task.learningResources ?? []).join('\n'));
  const [items, setItems] = useState<WorkItem[]>([{ title: '', description: '', deadline: task.deadline.slice(0, 10), assignedToIds: [] }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void workspaceService.workflowCandidates(task._id).then((result) => { if (active) setCandidates(result); }).catch((loadError) => { if (active) setError(getApiErrorMessage(loadError, 'Workflow candidates could not be loaded.')); }); return () => { active = false; }; }, [task._id]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await action(); onUpdated(); }
    catch (actionError) { setError(getApiErrorMessage(actionError, 'The workflow action failed.')); }
    finally { setBusy(false); }
  };
  const review = (decision: 'APPROVE' | 'ENHANCEMENT') => {
    if (decision === 'ENHANCEMENT' && !note.trim()) { setError('Add a note describing the required enhancement.'); return; }
    if (decision === 'ENHANCEMENT' && task.workflowStage === 'MANAGER_REVIEW' && !subtaskId) { setError('Choose the work item that needs enhancement.'); return; }
    void run(() => workspaceService.reviewWorkflow(task._id, decision, note.trim() || undefined, subtaskId || undefined));
  };
  const updateItem = (index: number, patch: Partial<WorkItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return <SafeAreaView className="flex-1 bg-white"><FormScrollView contentContainerClassName="gap-4 p-5"><PageHeader eyebrow={stageLabels[task.workflowStage ?? ''] ?? 'Workflow'} title={task.title} action={<IconButton icon="close" label="Close workflow task" onPress={onClose} />} /><Text className="font-sans text-sm leading-6 text-muted">{task.description}</Text><Text className="font-sans text-xs text-muted">Due {new Date(task.deadline).toLocaleDateString()}</Text>
    {canRoute ? <><SectionLabel>Route to department head</SectionLabel><TabBar value={department} onChange={setDepartment} options={departments.map((value) => ({ value, label: value }))} /><View className="gap-2">{candidates.filter((person) => person.level === 'HEAD' && person.department === department).map((person) => <ActionChip key={person._id} label={person.name} tone={recipient === person._id ? 'primary' : 'muted'} onPress={() => setRecipient(person._id)} />)}</View><Field multiline placeholder="Routing note" value={note} onChangeText={setNote} /><PrimaryButton label="Route to head" busy={busy} onPress={() => void run(() => workspaceService.routeWorkflowToHead(task._id, department, note.trim() || undefined, recipient || undefined))} /></> : null}
    {canPlan ? <><SectionLabel>Department planning</SectionLabel>{candidates.filter((person) => person.level === 'MANAGER').map((person) => <ActionChip key={person._id} label={person.name} tone={recipient === person._id ? 'primary' : 'muted'} onPress={() => setRecipient(person._id)} />)}<Field multiline placeholder="Project objective" value={objective} onChangeText={setObjective} /><Field multiline placeholder="Recommended stack (one per line)" value={stack} onChangeText={setStack} /><Field multiline placeholder="Requirements (one per line)" value={requirements} onChangeText={setRequirements} /><Field multiline placeholder="Final deliverables (one per line)" value={deliverables} onChangeText={setDeliverables} /><Field multiline placeholder="Learning resources (one URL per line)" value={resources} onChangeText={setResources} /><PrimaryButton label="Route plan to manager" busy={busy} disabled={!recipient || !objective.trim()} onPress={() => void run(() => workspaceService.planWorkflowTask(task._id, { managerId: recipient, projectObjective: objective.trim(), recommendedStack: lines(stack), requirements: lines(requirements), finalDeliverables: lines(deliverables), learningResources: lines(resources) }))} /></> : null}
    {canDelegate ? <><SectionLabel>Work breakdown</SectionLabel>{items.map((item, index) => <View key={index} className="gap-3 border-b border-line pb-4"><Text className="font-semibold text-sm text-ink">Work item {index + 1}</Text><Field placeholder="Work item title" value={item.title} onChangeText={(value) => updateItem(index, { title: value })} /><Field multiline placeholder="Work item description" value={item.description} onChangeText={(value) => updateItem(index, { description: value })} /><Field placeholder="Deadline YYYY-MM-DD" value={item.deadline} onChangeText={(value) => updateItem(index, { deadline: value })} /><View className="gap-2">{candidates.filter((person) => person.level === 'MEMBER').map((person) => <ActionChip key={person._id} label={person.name} tone={item.assignedToIds.includes(person._id) ? 'primary' : 'muted'} onPress={() => updateItem(index, { assignedToIds: item.assignedToIds.includes(person._id) ? item.assignedToIds.filter((id) => id !== person._id) : [...item.assignedToIds, person._id] })} />)}</View>{items.length > 1 ? <ActionChip label="Remove work item" tone="danger" onPress={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} /> : null}</View>)}<ActionChip label="Add work item" onPress={() => setItems((current) => [...current, { title: '', description: '', deadline: task.deadline.slice(0, 10), assignedToIds: [] }])} /><PrimaryButton label="Delegate work package" busy={busy} disabled={items.some((item) => !item.title.trim() || !item.description.trim() || !item.assignedToIds.length)} onPress={() => void run(() => workspaceService.delegateWorkflowTask(task._id, items))} /></> : null}
    {childrenTasks.length ? <><SectionLabel>Assigned work items</SectionLabel>{childrenTasks.map((child) => <DataCard key={child._id} title={child.title} badge={stageLabels[child.workflowStage ?? ''] ?? child.workflowStage} subtitle={typeof child.assignedTo !== 'string' ? child.assignedTo?.name : undefined}><Text className="font-sans text-sm leading-6 text-muted">{child.description}</Text>{child.submission ? <Text className="font-sans text-sm leading-6 text-muted">{child.submission.description}</Text> : null}{canReview && task.workflowStage === 'MANAGER_REVIEW' ? <ActionChip label="Select for enhancement" tone={subtaskId === child._id ? 'primary' : 'muted'} onPress={() => setSubtaskId(child._id)} /> : null}</DataCard>)}</> : null}
    {canReview ? <><SectionLabel>Review delivery</SectionLabel><Field multiline placeholder="Review note" value={note} onChangeText={setNote} /><PrimaryButton label={task.workflowStage === 'CEO_REVIEW' ? 'Accept completed work' : 'Accept and send to next review level'} busy={busy} onPress={() => review('APPROVE')} /><ActionChip label="Request enhancement" tone="danger" disabled={busy} onPress={() => review('ENHANCEMENT')} /></> : null}
    {task.workflowHistory?.length ? <><SectionLabel>Workflow history</SectionLabel>{task.workflowHistory.map((event, index) => <View key={`${event.createdAt}-${index}`} className="gap-1 border-l-2 border-line pl-3"><Text className="font-semibold text-xs text-ink">{event.action.replaceAll('_', ' ')}</Text><Text className="font-sans text-xs text-muted">{event.note}</Text><Text className="font-sans text-[11px] text-muted">{new Date(event.createdAt).toLocaleString()}</Text></View>)}</> : null}{error ? <ErrorBanner message={error} /> : null}
  </FormScrollView></SafeAreaView>;
}