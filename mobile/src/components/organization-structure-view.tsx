import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FormScrollView } from '@/components/ui/form-scroll-view';
import { Field, IconButton, PageHeader, PrimaryButton, SectionLabel } from '@/components/ui/primitives';
import { ActionChip, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { layoutOrganization, organizationForest, type OrganizationBranch } from '@/features/organization-model';
import { getApiErrorMessage } from '@/services/api';
import { organizationService, type OrganizationAssignment, type OrganizationLevel, type OrganizationUser } from '@/services/organization.service';
import { useAppSelector } from '@/store/hooks';

const departments = ['PRODUCT', 'MARKETING', 'FINANCE', 'SALES', 'PROJECTS', 'SUPPORT', 'HR', 'DESIGN', 'ENGINEERING'];
const nextLevel: Record<OrganizationLevel, OrganizationLevel | null> = { CEO: 'HEAD', HR: 'HEAD', HEAD: 'MANAGER', MANAGER: 'MEMBER', MEMBER: null };
const levelLabels = { CEO: 'Chief Executive Officer', HR: 'HR Administrator', HEAD: 'Department Head', MANAGER: 'Manager', MEMBER: 'Member' };
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
type Editor = { node?: OrganizationAssignment; parent?: OrganizationAssignment };

export function OrganizationStructureView() {
  const me = useAppSelector((state) => state.auth.user);
  const { width } = useWindowDimensions();
  const roles = me?.roles ?? [];
  const executive = roles.some((role) => role === 'ADMIN' || role === 'CEO');
  const head = roles.some((role) => role === 'HEAD' || role.endsWith('_HEAD'));
  const manager = roles.some((role) => role === 'MANAGER' || role.endsWith('_MANAGER'));
  const systemHr = roles.includes('HR') && (me?.system_roles?.includes('HR') || me?.organization_level === 'HR');
  const hr = !executive && (systemHr || (me?.organization_department === 'HR' && (head || manager || me?.organization_level === 'HR')));
  const structureAdmin = executive || hr;
  const [items, setItems] = useState<OrganizationAssignment[]>([]);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('ALL');
  const [chosenView, setChosenView] = useState<'chart' | 'outline'>();
  const [zoom, setZoom] = useState(1);
  const [chartWidth, setChartWidth] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [companyCollapsed, setCompanyCollapsed] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removing, setRemoving] = useState<OrganizationAssignment | null>(null);
  const [profile, setProfile] = useState<OrganizationUser & { about?: string; workingRole?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const view = chosenView ?? (width < 768 ? 'outline' : 'chart');
  const forest = organizationForest(items, department, query);
  const effectiveCollapsed = query.trim() ? new Set<string>() : collapsed;
  const layout = layoutOrganization(companyCollapsed ? [] : forest, effectiveCollapsed);
  const companyName = me?.company?.name ?? 'First Ricoz Private Limited';

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError('');
      try { const result = await organizationService.list(); if (active) setItems(result); }
      catch (loadError) { if (active) setError(getApiErrorMessage(loadError, 'The organization could not be loaded.')); }
      finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [reload]);

  const toggle = (id: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const canEdit = (item: OrganizationAssignment) => {
    if (item.userId._id === me?.user_id) return executive;
    if (executive) return true;
    if (hr) return systemHr || (!['CEO', 'HR'].includes(item.level) && !item.userId.roles.includes('ADMIN'));
    return (head && item.level === 'MEMBER' && item.department === me?.organization_department) || (item.reportsTo?._id === me?.user_id && ((head && item.level === 'MANAGER') || (manager && item.level === 'MEMBER')));
  };
  const canAdd = (item: OrganizationAssignment) => executive || (structureAdmin && Boolean(nextLevel[item.level])) || (item.userId._id === me?.user_id && ((head && item.level === 'HEAD') || (manager && item.level === 'MANAGER')));
  const openProfile = async (item: OrganizationAssignment) => {
    try { setProfile(await organizationService.profile(item.userId._id)); }
    catch (loadError) { Alert.alert('Person', getApiErrorMessage(loadError, 'The profile could not be loaded.')); }
  };

  const person = (branch: OrganizationBranch, chart = false) => {
    const item = branch.item;
    const id = item.userId._id;
    const matches = Boolean(query.trim() && `${item.userId.name} ${item.userId.email}`.toLowerCase().includes(query.trim().toLowerCase()));
    return <View className={`gap-2 rounded-card border bg-white p-3 ${matches ? 'border-coral' : 'border-line'}`} style={chart ? { width: layout.nodeWidth, height: layout.nodeHeight } : undefined}>
      <View className="flex-row items-center gap-2"><View className="h-9 w-9 shrink-0 items-center justify-center rounded-card bg-[#eef4ff]"><Text className="font-semibold text-xs text-[#1645a2]">{initials(item.userId.name)}</Text></View><Pressable onPress={() => void openProfile(item)} className="min-w-0 flex-1"><Text numberOfLines={chart ? 1 : undefined} className="font-semibold text-sm text-ink">{item.userId.name}</Text><Text className="font-sans text-[11px] leading-4 text-muted">{levelLabels[item.level]}</Text></Pressable>{branch.children.length ? <Pressable accessibilityLabel={`${effectiveCollapsed.has(id) ? 'Expand' : 'Collapse'} ${item.userId.name}`} onPress={() => toggle(id)} className="h-9 w-9 items-center justify-center"><Ionicons name={effectiveCollapsed.has(id) ? 'chevron-down' : 'chevron-up'} size={18} color={colors.muted} /></Pressable> : null}</View>
      <Text numberOfLines={chart ? 1 : undefined} className="font-sans text-[11px] text-muted">{item.department} / {item.userId.roles.includes('EMPLOYEE') ? 'Employee' : item.userId.roles.includes('INTERN') ? 'Intern' : item.level}</Text>
      <View className="flex-row items-center gap-2"><Text className="flex-1 font-medium text-[10px] text-muted">{branch.children.length} direct reports</Text>{canAdd(item) ? <Pressable accessibilityLabel={`Add report under ${item.userId.name}`} className="h-8 w-8 items-center justify-center rounded-card bg-paper" onPress={() => setEditor({ parent: item })}><Ionicons name="person-add-outline" size={16} color="#1645a2" /></Pressable> : null}{canEdit(item) ? <><Pressable accessibilityLabel={`Edit ${item.userId.name}`} className="h-8 w-8 items-center justify-center rounded-card bg-paper" onPress={() => setEditor({ node: item })}><Ionicons name="create-outline" size={16} color={colors.muted} /></Pressable><Pressable accessibilityLabel={`Remove ${item.userId.name}`} className="h-8 w-8 items-center justify-center rounded-card bg-red-50" onPress={() => setRemoving(item)}><Ionicons name="trash-outline" size={16} color={colors.danger} /></Pressable></> : null}</View>
    </View>;
  };
  const outline = (branches: OrganizationBranch[], depth = 0) => branches.map((branch) => <View key={branch.item.userId._id} className="gap-2" style={{ marginLeft: depth ? 14 : 0, borderLeftWidth: depth ? 1 : 0, borderLeftColor: colors.line, paddingLeft: depth ? 10 : 0 }}>{person(branch)}{!effectiveCollapsed.has(branch.item.userId._id) ? outline(branch.children, depth + 1) : null}</View>);

  return <FormScrollView className="bg-canvas" contentContainerClassName="gap-4 px-4 pb-8 pt-4">
    <PageHeader eyebrow="People & structure" title="Organization chart" description={structureAdmin ? 'Manage people from their place in the reporting tree.' : "Your department's reporting tree and direct reports."} />
    {structureAdmin ? <ActionChip label="Add person" tone="primary" onPress={() => setEditor({})} /> : null}
    <StatGrid items={[{ label: 'People', value: items.length }, { label: 'Departments', value: new Set(items.map((item) => item.department)).size }, { label: 'Heads', value: items.filter((item) => item.level === 'HEAD').length }, { label: 'Managers', value: items.filter((item) => item.level === 'MANAGER').length }, { label: 'Members', value: items.filter((item) => item.level === 'MEMBER').length }]} />
    <Field icon="search-outline" placeholder="Find a person or role" value={query} onChangeText={setQuery} />
    {structureAdmin ? <TabBar value={department} onChange={setDepartment} options={['ALL', ...departments].map((value) => ({ value, label: value === 'ALL' ? 'All departments' : value }))} /> : null}
    <View className="flex-row flex-wrap items-center gap-2"><ActionChip label="Chart" tone={view === 'chart' ? 'primary' : 'muted'} onPress={() => setChosenView('chart')} /><ActionChip label="Outline" tone={view === 'outline' ? 'primary' : 'muted'} onPress={() => setChosenView('outline')} /><IconButton icon="refresh" label="Refresh organization" onPress={() => setReload((value) => value + 1)} /></View>
    <View className="flex-row flex-wrap gap-2"><ActionChip label="Expand all" onPress={() => { setCompanyCollapsed(false); setCollapsed(new Set()); }} /><ActionChip label="Collapse all" onPress={() => setCollapsed(new Set(items.map((item) => item.userId._id)))} />{view === 'chart' ? <><IconButton icon="remove" label="Zoom out" onPress={() => setZoom((value) => Math.max(0.4, value - 0.1))} /><ActionChip label={`${Math.round(zoom * 100)}%`} onPress={() => setZoom(1)} /><IconButton icon="add" label="Zoom in" onPress={() => setZoom((value) => Math.min(1.2, value + 0.1))} /><IconButton icon="scan-outline" label="Fit chart to screen" onPress={() => setZoom(Math.max(0.4, Math.min(1.2, ((chartWidth || width - 40) - 8) / layout.width)))} /></> : null}</View>
    {loading ? <Loader /> : error ? <ErrorBanner message={error} onRetry={() => setReload((value) => value + 1)} /> : !items.length ? <EmptyHint icon="git-network-outline" title="No organization assignments" description="Add people to build the reporting structure." /> : view === 'outline' ? <View className="gap-3"><Pressable accessibilityLabel="Toggle company hierarchy" onPress={() => setCompanyCollapsed((value) => !value)} className="min-h-14 flex-row items-center gap-3 rounded-card border border-line bg-white p-4"><Ionicons name="business-outline" size={21} color="#1645a2" /><Text className="flex-1 font-semibold text-sm text-ink">{companyName}</Text><Ionicons name={companyCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.muted} /></Pressable>{!companyCollapsed ? forest.length ? outline(forest) : <EmptyHint title="No matching people" /> : null}</View> : <ScrollView horizontal showsHorizontalScrollIndicator onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} className="rounded-card border border-line bg-[#f8fafc]" style={{ flexGrow: 0 }}><View style={{ width: layout.width * zoom, height: layout.height * zoom }}><View style={{ width: layout.width, height: layout.height, transform: [{ scale: zoom }], transformOrigin: 'top left' }}>
      <Svg width={layout.width} height={layout.height} style={{ position: 'absolute' }}>{layout.edges.map((edge, index) => <Path key={index} d={`M ${edge.fromX} ${edge.fromY} V ${(edge.fromY + edge.toY) / 2} H ${edge.toX} V ${edge.toY}`} fill="none" stroke="#cdd6e5" strokeWidth={1.5} />)}</Svg>
      <Pressable onPress={() => setCompanyCollapsed((value) => !value)} className="absolute gap-2 rounded-card border border-line bg-white p-4" style={{ left: (layout.width - layout.nodeWidth) / 2, top: 16, width: layout.nodeWidth, height: 96 }}><Ionicons name="business-outline" size={24} color="#1645a2" /><Text numberOfLines={2} className="font-semibold text-sm text-ink">{companyName}</Text></Pressable>
      {layout.nodes.map((node) => <View key={node.branch.item.userId._id} style={{ position: 'absolute', left: node.x, top: node.y }}>{person(node.branch, true)}</View>)}
    </View></View></ScrollView>}
    <Modal visible={Boolean(editor)} animationType="slide" onRequestClose={() => setEditor(null)}>{editor ? <OrganizationEditor editor={editor} allowHr={executive || roles.includes('HR')} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setReload((value) => value + 1); }} /> : null}</Modal>
    <Modal visible={Boolean(removing)} animationType="slide" onRequestClose={() => setRemoving(null)}>{removing ? <RemovalPanel item={removing} onClose={() => setRemoving(null)} onRemoved={() => { setRemoving(null); setReload((value) => value + 1); }} /> : null}</Modal>
    <Modal visible={Boolean(profile)} animationType="slide" onRequestClose={() => setProfile(null)}><SafeAreaView className="flex-1 bg-canvas"><FormScrollView contentContainerClassName="gap-4 p-5"><PageHeader eyebrow="Person" title={profile?.name ?? 'Profile'} action={<IconButton icon="close" label="Close profile" onPress={() => setProfile(null)} />} /><Text className="font-sans text-sm text-muted">{profile?.email}</Text><Text className="font-semibold text-sm text-ink">{profile?.workingRole ?? profile?.roles.join(' / ')}</Text><Text className="font-sans text-sm text-muted">{profile?.about}</Text></FormScrollView></SafeAreaView></Modal>
  </FormScrollView>;
}


function RemovalPanel({ item, onClose, onRemoved }: { item: OrganizationAssignment; onClose: () => void; onRemoved: () => void }) {
  const [requested, setRequested] = useState(false);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = async () => {
    setBusy(true); setError('');
    try { setMessage(await organizationService.requestRemoval(item.userId._id)); setRequested(true); }
    catch (requestError) { setError(getApiErrorMessage(requestError, 'Removal verification could not be requested.')); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!/^\d{6}$/.test(otp)) { setError('Enter the six-digit verification code.'); return; }
    setBusy(true); setError('');
    try { await organizationService.confirmRemoval(item.userId._id, otp); onRemoved(); }
    catch (confirmError) { setError(getApiErrorMessage(confirmError, 'The person could not be removed.')); }
    finally { setBusy(false); }
  };
  return <SafeAreaView className="flex-1 bg-white"><FormScrollView contentContainerClassName="gap-4 p-5"><PageHeader eyebrow="Organization" title="Remove person" action={<IconButton icon="close" label="Close removal" onPress={onClose} />} /><Text className="font-semibold text-base text-ink">{item.userId.name}</Text><Text className="font-sans text-sm leading-6 text-muted">Removal requires an emailed verification code and is subject to organization access rules.</Text>{message ? <Text className="font-sans text-sm text-muted">{message}</Text> : null}{requested ? <><Field placeholder="Verification code" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} /><PrimaryButton label="Confirm removal" busy={busy} onPress={() => void confirm()} /></> : <PrimaryButton label="Request removal code" busy={busy} onPress={() => void request()} />}{error ? <ErrorBanner message={error} /> : null}</FormScrollView></SafeAreaView>;
}
function OrganizationEditor({ editor, allowHr, onClose, onSaved }: { editor: Editor; allowHr: boolean; onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [userId, setUserId] = useState(editor.node?.userId._id ?? '');
  const [level, setLevel] = useState<OrganizationLevel>(editor.node?.level ?? (editor.parent ? nextLevel[editor.parent.level] ?? 'MEMBER' : 'CEO'));
  const [department, setDepartment] = useState(editor.node?.department ?? editor.parent?.department ?? 'PRODUCT');
  const [memberRole, setMemberRole] = useState<'EMPLOYEE' | 'INTERN'>(editor.node?.userId.roles.includes('INTERN') ? 'INTERN' : 'EMPLOYEE');
  const [reportsTo, setReportsTo] = useState(editor.node?.reportsTo?._id ?? editor.parent?.userId._id ?? '');
  const [options, setOptions] = useState<OrganizationUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void organizationService.users(query).then((result) => { if (active) setUsers(result); }).catch((loadError) => { if (active) setError(getApiErrorMessage(loadError, 'People could not be loaded.')); }); return () => { active = false; }; }, [query]);
  useEffect(() => { let active = true; void organizationService.reportingOptions(level, department).then((result) => { if (active) setOptions(result); }).catch((loadError) => { if (active) setError(getApiErrorMessage(loadError, 'Reporting options could not be loaded.')); }); return () => { active = false; }; }, [level, department]);
  const save = async () => {
    if (!userId) { setError('Choose a person first.'); return; }
    setBusy(true); setError('');
    try { await organizationService.assign({ userId, level, department, ...(level === 'MEMBER' ? { memberRole } : {}), reportsTo: level === 'CEO' ? undefined : reportsTo || undefined, roleKeys: editor.node?.roleKeys }); onSaved(); }
    catch (saveError) { setError(getApiErrorMessage(saveError, 'The assignment could not be saved.')); }
    finally { setBusy(false); }
  };
  return <SafeAreaView className="flex-1 bg-canvas"><FormScrollView contentContainerClassName="gap-4 p-5"><PageHeader eyebrow="Reporting structure" title={editor.node ? 'Edit person' : 'Add person'} action={<IconButton icon="close" label="Close assignment editor" onPress={onClose} />} />
    {editor.node ? <Text className="font-semibold text-base text-ink">{editor.node.userId.name}</Text> : <><Field placeholder="Search people" value={query} onChangeText={setQuery} /><View className="gap-2">{users.map((user) => <ActionChip key={user._id} label={`${user.name} - ${user.email}`} tone={userId === user._id ? 'primary' : 'muted'} onPress={() => setUserId(user._id)} />)}</View></>}
    <SectionLabel>Organization level</SectionLabel><TabBar value={level} onChange={(value) => setLevel(value as OrganizationLevel)} options={(['CEO', ...(allowHr ? ['HR'] : []), 'HEAD', 'MANAGER', 'MEMBER']).map((value) => ({ value, label: value }))} />
    <SectionLabel>Department</SectionLabel><TabBar value={department} onChange={setDepartment} options={departments.map((value) => ({ value, label: value }))} />
    {level === 'MEMBER' ? <TabBar value={memberRole} onChange={(value) => setMemberRole(value as typeof memberRole)} options={[{ value: 'EMPLOYEE', label: 'Employee' }, { value: 'INTERN', label: 'Intern' }]} /> : null}
    {level !== 'CEO' ? <><SectionLabel>Reports to</SectionLabel><View className="gap-2"><ActionChip label="No reporting parent" tone={!reportsTo ? 'primary' : 'muted'} onPress={() => setReportsTo('')} />{options.filter((user) => user._id !== userId).map((user) => <ActionChip key={user._id} label={user.name} tone={reportsTo === user._id ? 'primary' : 'muted'} onPress={() => setReportsTo(user._id)} />)}</View></> : null}
    {error ? <ErrorBanner message={error} /> : null}<PrimaryButton label="Save assignment" icon="checkmark" busy={busy} onPress={() => void save()} />
  </FormScrollView></SafeAreaView>;
}