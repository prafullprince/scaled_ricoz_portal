import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { CustomerPortalView } from '@/components/customer-portal-view';
import { HrWorkspaceView } from '@/components/hr-workspace-view';
import { InvestorPortalView } from '@/components/investor-portal-view';
import { MarketingWorkspaceView } from '@/components/marketing-workspace-view';
import { SalesWorkspaceView } from '@/components/sales-workspace-view';
import { TaskWorkflowView } from '@/components/workflow-tasks-view';
import { ErrorBanner, Loader } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { dashboardKind, dashboardMetrics, greetingFor, type DashboardAttendance, type DashboardLeave, type DashboardSchedule, type DashboardTask } from '@/features/dashboard-model';
import { workspaceService } from '@/services/workspace.service';
import { adminService } from '@/services/admin.service';
import { useDashboardDepartment } from '@/providers/dashboard-department';
import type { User } from '@/types/auth';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function DashboardView({ user }: { user: User | null }) {
  const { department, setDepartment } = useDashboardDepartment();
  if (!user) return null;
  const kind = dashboardKind(user, department);
  const executive = user.roles.some((role) => role === 'ADMIN' || role === 'CEO');
  return (
    <View className="flex-1 bg-canvas">
      {executive ? <ScrollView horizontal className="lg:hidden" showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {['Overview', 'PRODUCT', 'MARKETING', 'FINANCE', 'SALES', 'PROJECTS', 'SUPPORT', 'HR', 'DESIGN', 'ENGINEERING'].map((item) => {
          const selected = item === (department ?? 'Overview');
          return <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setDepartment(item === 'Overview' ? undefined : item)} className={`min-h-9 justify-center rounded-card border px-3 ${selected ? 'border-coral bg-coral' : 'border-line bg-white'}`}><Text className={`font-semibold text-xs ${selected ? 'text-white' : 'text-muted'}`}>{item === 'Overview' ? item : item.charAt(0) + item.slice(1).toLowerCase()}</Text></Pressable>;
        })}
      </ScrollView> : null}
      {kind === 'sales' ? <SalesWorkspaceView /> : kind === 'marketing' ? <MarketingWorkspaceView /> : kind === 'hr' ? <HrWorkspaceView /> : kind === 'workflow' ? <TaskWorkflowView key={department} department={department} /> : kind === 'investor' ? <InvestorPortalView /> : kind === 'customer' ? <CustomerPortalView /> : <PersonalDashboard key={user.user_id} user={user} executive={kind === 'executive'} />}
    </View>
  );
}

function PersonalDashboard({ user, executive }: { user: User; executive: boolean }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [attendance, setAttendance] = useState<DashboardAttendance | null>(null);
  const [leave, setLeave] = useState<DashboardLeave[]>([]);
  const [schedule, setSchedule] = useState<DashboardSchedule[]>([]);
  const [scheduleError, setScheduleError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const isIntern = user.roles.includes('INTERN');
  const personalAccess = user.roles.some((role) => role === 'INTERN' || role === 'EMPLOYEE');
  const metrics = dashboardMetrics(tasks, attendance, leave);
  const roleLabel = user.roles.includes('CEO') ? 'CEO' : user.roles.includes('ADMIN') ? 'Admin' : user.roles.some((role) => role === 'HEAD' || role.endsWith('_HEAD')) ? 'Department Head' : 'Manager';
  const open = (slug: string) => router.push({ pathname: '/feature/[slug]', params: { slug } });

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError('');
      const results = await Promise.allSettled([
        executive || personalAccess ? workspaceService.tasks() : Promise.resolve({ tasks: [] }),
        executive || personalAccess ? workspaceService.attendance() : Promise.resolve({ attendance: null }),
        executive ? workspaceService.personalLeave() : Promise.resolve({ leave: { requests: [] } }),
        personalAccess && !executive ? workspaceService.roleDashboard(isIntern ? 'intern' : 'employee') : Promise.resolve({ schedule: [] }),
      ]);
      if (!active) return;
      const [taskResult, attendanceResult, leaveResult, scheduleResult] = results;
      setTasks(taskResult.status === 'fulfilled' ? (taskResult.value as { tasks: DashboardTask[] }).tasks ?? [] : []);
      setAttendance(attendanceResult.status === 'fulfilled' ? (attendanceResult.value as { attendance: DashboardAttendance | null }).attendance : null);
      setLeave(leaveResult.status === 'fulfilled' ? (leaveResult.value as { leave: { requests: DashboardLeave[] } }).leave.requests : []);
      setSchedule(scheduleResult.status === 'fulfilled' ? (scheduleResult.value as { schedule: DashboardSchedule[] }).schedule ?? [] : []);
      setScheduleError(scheduleResult.status === 'rejected');
      if (results.some((result) => result.status === 'rejected')) setError('Some personal workspace data could not be loaded.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [executive, personalAccess, isIntern, reloadKey]);

  const toggleAttendance = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (metrics.checkedIn) await workspaceService.checkOut();
      else await workspaceService.checkIn();
      setReloadKey((value) => value + 1);
    } catch { setError('Attendance could not be updated. Please try again.'); }
    finally { setBusy(false); }
  };

  const quickActions: { label: string; slug: string; icon: IconName }[] = executive ? [
    { label: 'Attendance history', slug: 'attendance', icon: 'time-outline' },
    { label: 'My calendar', slug: 'calendar', icon: 'calendar-outline' },
    { label: 'Daily planner', slug: 'planner', icon: 'list-outline' },
    { label: 'Team workspace', slug: user.roles.some((role) => role === 'MANAGER' || role.endsWith('_MANAGER')) ? 'team' : user.organization_department === 'SALES' ? 'sales' : user.organization_department === 'MARKETING' ? 'marketing' : user.organization_department === 'HR' ? 'hr-workspace' : 'tasks', icon: 'people-outline' },
  ] : [
    { label: 'My tasks', slug: 'tasks', icon: 'list-outline' },
    { label: 'My projects', slug: isIntern ? 'projects' : 'work', icon: 'folder-outline' },
    { label: 'Message team', slug: 'chat', icon: 'chatbubble-outline' },
    ...(!isIntern ? [{ label: 'Documents', slug: 'documents', icon: 'document-text-outline' as const }] : []),
  ];

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-5 px-4 pb-8 pt-5 web:mx-auto web:w-full web:max-w-[1440px]" refreshControl={<RefreshControl refreshing={loading && reloadKey > 0} onRefresh={() => setReloadKey((value) => value + 1)} tintColor={colors.brand} />}>
      {executive ? <View className="gap-2 border-b border-line pb-5">
        <Text className="font-semibold text-xs text-coral">{roleLabel} personal workspace</Text>
        <Text className="font-bold text-[26px] leading-8 text-ink">{greetingFor(new Date())}, {user.user_name.trim().split(/\s+/)[0]}</Text>
        <Text className="font-sans text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Pressable onPress={() => open('planner')} className="mt-2 min-h-10 flex-row items-center justify-center gap-2 self-start rounded-card bg-coral px-4"><Text className="font-semibold text-sm text-white">Open daily planner</Text><Ionicons name="arrow-forward" size={16} color="white" /></Pressable>
      </View> : <View className="gap-3 rounded-card bg-[#00b982] p-5">
        <View className="flex-row items-center gap-2"><Ionicons name="sparkles-outline" size={15} color="white" /><Text className="font-semibold text-xs text-white">AI morning brief</Text></View>
        <Text className="font-bold text-[22px] leading-7 text-white">{greetingFor(new Date())}, {user.user_name.trim().split(/\s+/)[0]}!</Text>
        <Text className="font-sans text-sm leading-5 text-white">You have {metrics.active.length} active tasks and {schedule.length} saved schedule items. Stay focused on your highest-impact work.</Text>
        <View className="flex-row flex-wrap gap-2">{[`${metrics.active.length} Tasks Active`, `${metrics.completed} Tasks Completed`, `${metrics.delayed} Deadlines At Risk`].map((label) => <View key={label} className="rounded-card bg-white/20 px-3 py-2"><Text className="font-semibold text-xs text-white">{label}</Text></View>)}</View>
      </View>}
      {executive && user.roles.includes('ADMIN') ? <AdministrationOverview open={open} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      <View className={`flex-row flex-wrap ${executive ? 'border-y border-line' : 'gap-3'}`}>
        {(executive ? [
          { label: 'My active tasks', value: metrics.active.length, caption: '', icon: 'list-outline' as const, tone: colors.brand },
          { label: 'Present days this month', value: metrics.present ?? '--', caption: '', icon: 'time-outline' as const, tone: colors.brand },
          { label: 'Pending time off', value: metrics.pendingLeave, caption: '', icon: 'flag-outline' as const, tone: colors.brand },
          { label: 'Completed tasks', value: metrics.completed, caption: '', icon: 'checkmark-circle-outline' as const, tone: colors.brand },
        ] : [
          { label: 'Completed tasks', value: metrics.completed, caption: 'of assigned tasks', icon: 'checkmark-circle-outline' as const, tone: '#00a96f' },
          { label: 'Completion rate', value: metrics.completionRate, caption: 'of assigned tasks', icon: 'trending-up-outline' as const, tone: '#246bfe' },
          { label: 'Attendance', value: metrics.present ?? '--', caption: 'days present this month', icon: 'time-outline' as const, tone: '#f59e0b' },
          { label: 'Delayed tasks', value: metrics.delayed, caption: 'based on task deadlines', icon: 'flag-outline' as const, tone: '#9747ff' },
        ]).map((metric) => <View key={metric.label} className={`min-h-28 flex-grow basis-[45%] p-4 md:basis-[22%] ${executive ? 'border-line' : 'rounded-card border border-line bg-white'}`}>
          <View className="flex-row items-start justify-between gap-2"><Text className="flex-1 font-semibold text-xs leading-4 text-muted">{metric.label}</Text><Ionicons name={metric.icon} size={18} color={metric.tone} /></View>
          <Text className="mt-3 font-bold text-[25px] text-ink">{loading ? '--' : metric.value}</Text>
          {metric.caption ? <Text className="mt-1 font-sans text-[11px] text-muted">{metric.caption}</Text> : null}
        </View>)}
      </View>
      <View className="gap-5 lg:flex-row">
        <View className={`flex-1 ${executive ? 'border-b border-line pb-5' : 'overflow-hidden rounded-card border border-line bg-white'}`}>
          <View className={`flex-row items-center justify-between gap-3 ${executive ? 'pb-3' : 'border-b border-line p-4'}`}><Text className="font-semibold text-base text-ink">{executive ? 'My schedule' : "Today's tasks"}</Text><Pressable onPress={() => open(executive ? 'calendar' : 'tasks')} className="min-h-10 flex-row items-center gap-1"><Ionicons name={executive ? 'arrow-forward' : 'add'} color={colors.brand} size={15} /><Text className="font-semibold text-xs text-coral">{executive ? 'Calendar' : 'Add task'}</Text></Pressable></View>
          {executive ? <Text className="mb-2 font-sans text-xs text-muted">Upcoming deadlines for work assigned to you</Text> : null}
          {loading ? <Loader /> : (executive ? metrics.upcoming : metrics.active.slice(0, 5)).length ? (executive ? metrics.upcoming : metrics.active.slice(0, 5)).map((task) => <Pressable key={task._id} onPress={() => open('tasks')} className={`min-h-20 flex-row items-center gap-3 border-b border-line py-4 ${executive ? '' : 'px-4'}`}>
            <Ionicons name={executive ? 'calendar-outline' : 'ellipse-outline'} size={21} color={executive ? '#00a96f' : '#cdd1d4'} />
            <View className="flex-1 gap-1"><Text className="font-semibold text-sm leading-5 text-ink">{task.title}</Text><Text className={`font-sans text-xs leading-4 ${task.effectiveStatus === 'DELAYED' ? 'text-danger' : 'text-muted'}`}>{!executive ? `${task.projectObjective || 'Ricoz workspace'} - ` : ''}{new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{task.effectiveStatus === 'DELAYED' ? ' - Overdue' : ''}</Text></View>
          </Pressable>) : <Text className="px-4 py-7 font-sans text-sm text-muted">{executive ? 'No upcoming personal task deadlines.' : "You're all caught up."}</Text>}
        </View>
        <View className="flex-1 gap-5 lg:max-w-[440px]">
          {executive ? <>
            <View className="gap-3 border-b border-line pb-4"><Text className="font-semibold text-lg text-ink">My attendance</Text><Text className="font-sans text-xs text-muted">{metrics.checkedIn ? `Checked in at ${new Date(attendance!.today!.openSession!.checkIn).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'No active session today'}</Text><Pressable disabled={busy || loading} onPress={() => void toggleAttendance()} className={`min-h-10 justify-center self-start rounded-card border border-line bg-white px-4 ${busy || loading ? 'opacity-50' : ''}`}><Text className="font-semibold text-sm text-ink">{busy ? 'Updating...' : metrics.checkedIn ? 'Check out' : 'Check in'}</Text></Pressable></View>
            <View className="gap-2 border-b border-line pb-4"><Text className="font-semibold text-lg text-ink">Leave &amp; time off</Text><Text className="font-sans text-xs text-muted">{metrics.pendingLeave} request{metrics.pendingLeave === 1 ? '' : 's'} awaiting a decision</Text><Pressable onPress={() => open('leave')} className="min-h-10 justify-center"><Text className="font-semibold text-sm text-coral">My requests</Text></Pressable></View>
          </> : <View className="overflow-hidden rounded-card border border-line bg-white"><Text className="border-b border-line p-4 font-semibold text-base text-ink">Saved schedule</Text>{schedule.length ? schedule.map((item, index) => <View key={`${item.title}-${index}`} className="flex-row gap-3 p-4"><View className="w-1 rounded-card bg-[#00b982]" /><View className="flex-1 gap-1"><Text className="font-semibold text-sm text-ink">{item.title}</Text><Text className="font-sans text-xs text-muted">{item.time} - {item.duration}</Text></View></View>) : <Text className="p-4 font-sans text-sm text-muted">{loading ? 'Loading schedule...' : scheduleError ? 'Schedule data is unavailable.' : 'No schedule items have been added.'}</Text>}</View>}
          <View className="gap-3"><Text className="font-semibold text-base text-ink">Quick actions</Text><View className="flex-row flex-wrap gap-2">{quickActions.map((action) => <Pressable key={action.slug} onPress={() => open(action.slug)} className="min-h-11 flex-row items-center gap-2 rounded-card border border-line bg-white px-3"><Ionicons name={action.icon} size={16} color={colors.ink} /><Text className="font-semibold text-xs text-ink">{action.label}</Text></Pressable>)}</View></View>
        </View>
      </View>
    </ScrollView>
  );
}

type GovernanceOverview = {
  metrics: { companies: number; users: number; activeHr: number; assignments: number };
  audit: { _id: string; action: string; status: string; createdAt: string; actorId?: { name: string } | null; targetUserId?: { name: string } | null; companyId?: { name: string } | null }[];
};

function AdministrationOverview({ open }: { open: (slug: string) => void }) {
  const [data, setData] = useState<GovernanceOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    void adminService.overview().then((result) => { if (active) setData(result as GovernanceOverview); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <View className="gap-4 border-b border-line pb-5">
    <Text className="font-semibold text-lg text-ink">Administration overview</Text>
    <View className="flex-row flex-wrap gap-4">{[{ label: 'Companies', slug: 'companies' }, { label: 'All users', slug: 'users-base' }, { label: 'HR & features', slug: 'admin-hr' }].map((item) => <Pressable key={item.slug} onPress={() => open(item.slug)} className="min-h-10 justify-center"><Text className="font-semibold text-sm text-coral">{item.label}</Text></Pressable>)}</View>
    {failed ? <ErrorBanner message="Administration overview could not be loaded." /> : <View className="flex-row flex-wrap gap-4">{[
      { label: 'Companies', value: data?.metrics.companies },
      { label: 'Users', value: data?.metrics.users },
      { label: 'Active HR', value: data?.metrics.activeHr },
      { label: 'HR company assignments', value: data?.metrics.assignments },
    ].map((metric) => <View key={metric.label} className="basis-[45%] flex-grow border-l-2 border-line pl-3 md:basis-[22%]"><Text className="font-sans text-xs text-muted">{metric.label}</Text><Text className="mt-1 font-semibold text-2xl text-ink">{metric.value ?? '--'}</Text></View>)}</View>}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} className="min-h-10 flex-row items-center gap-2"><Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} color={colors.ink} size={16} /><Text className="font-semibold text-sm text-ink">Recent access changes</Text></Pressable>
    {expanded ? <View>{data?.audit.length ? data.audit.map((entry) => <View key={entry._id} className="gap-1 border-b border-line py-3"><Text className="font-semibold text-xs text-ink">{entry.action.replaceAll('_', ' ')}</Text><Text className="font-sans text-xs text-muted">{[entry.actorId?.name ?? 'Removed user', entry.targetUserId?.name, entry.companyId?.name].filter(Boolean).join(' / ')}</Text><Text className="font-sans text-xs text-muted">{entry.status} / {new Date(entry.createdAt).toLocaleString()}</Text></View>) : <Text className="font-sans text-xs text-muted">No recent access changes.</Text>}</View> : null}
  </View>;
}