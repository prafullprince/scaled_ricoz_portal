import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AboutView } from '@/components/about-view';
import { AdminHrView } from '@/components/admin-hr-view';
import { AssistantView } from '@/components/assistant-view';
import { AttendanceView } from '@/components/attendance-view';
import { CalendarView } from '@/components/calendar-view';
import { ChatConversationsView } from '@/components/chat-conversations-view';
import { ChatActivityView } from '@/components/chat-activity-view';
import { CompaniesView } from '@/components/companies-view';
import { ComplianceView } from '@/components/compliance-view';
import { ContactView } from '@/components/contact-view';
import { CustomerPortalView } from '@/components/customer-portal-view';
import { DashboardView } from '@/components/website-dashboard-view';
import { FeatureDataView } from '@/components/feature-data-view';
import { GoalsView } from '@/components/goals-view';
import { HrWorkspaceView } from '@/components/hr-workspace-view';
import { InvestorPortalView } from '@/components/investor-portal-view';
import { LeaveView } from '@/components/leave-view';
import { MarketingWorkspaceView } from '@/components/marketing-workspace-view';
import { NotificationsView } from '@/components/notifications-view';
import { OnboardingView } from '@/components/onboarding-view';
import { OrganizationView } from '@/components/organization-view';
import { OrganizationStructureView } from '@/components/organization-structure-view';
import { PlannerView } from '@/components/planner-view';
import { ProductsView } from '@/components/products-view';
import { RecruitmentView } from '@/components/recruitment-view';
import { RecruitmentAdminView } from '@/components/recruitment-admin-view';
import { RoleAreaView } from '@/components/role-area-view';
import { SalesWorkspaceView } from '@/components/sales-workspace-view';
import { SecurityView } from '@/components/security-view';
import { ServiceRequestsView } from '@/components/service-requests-view';
import { SettingsView } from '@/components/settings-view';
import { TaskReportsView } from '@/components/website-task-reports-view';
import { TaskWorkflowView } from '@/components/workflow-tasks-view';
import { TasksWorkspaceView } from '@/components/tasks-workspace-view';
import { TeamView } from '@/components/team-view';
import { EmptyHint } from '@/components/ui/view-kit';
import { UsersDirectoryView } from '@/components/users-directory-view';
import { colors } from '@/constants/theme';
import { canAccessFeature, mobileFeatures } from '@/features/registry';
import { useAppSelector } from '@/store/hooks';
import { chatPalette, useChatTheme } from '@/providers/chat-theme';

export default function FeatureScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const { theme } = useChatTheme();
  const roles = user?.roles ?? [];
  const feature = mobileFeatures.find((item) => item.slug === slug);
  const taskLeader = roles.some((role) => role === 'ADMIN' || role === 'CEO' || role === 'HR' || role === 'HEAD' || role === 'MANAGER' || role.endsWith('_HEAD') || role.endsWith('_MANAGER'));
  const isTaskContributor = !taskLeader && (roles.includes('INTERN') || roles.includes('EMPLOYEE'));

  if (!feature || !canAccessFeature(feature, user)) {
    return <EmptyHint icon="lock-closed-outline" title={feature ? 'Access restricted' : 'Feature not found'} description="This workspace is not available for your account." />;
  }

  const screens: Record<string, ReactNode> = {
    dashboard: <DashboardView user={user} />,
    sales: <SalesWorkspaceView />,
    assistant: <AssistantView />,
    attendance: <AttendanceView />,
    chat: <ChatConversationsView />,
    statuses: <ChatActivityView mode="statuses" />,
    calls: <ChatActivityView mode="calls" />,
    planner: <PlannerView />,
    leave: <LeaveView />,
    tasks: isTaskContributor ? <TasksWorkspaceView /> : <TaskWorkflowView />,
    recruitment: <RecruitmentView />,
    applications: <RecruitmentView initialTab="applications" />,
    'recruitment-admin': <RecruitmentAdminView />,
    investor: <InvestorPortalView />,
    organization: <OrganizationStructureView />,
    admin: <OrganizationView adminOnly />,
    calendar: <CalendarView />,
    goals: <GoalsView />,
    'task-report': <TaskReportsView mode="mine" />,
    'task-reports': <TaskReportsView mode="team" />,
    notifications: <NotificationsView />,
    settings: <SettingsView />,
    security: <SecurityView />,
    compliance: <ComplianceView />,
    companies: <CompaniesView />,
    onboarding: <OnboardingView />,
    'users-base': <UsersDirectoryView />,
    products: <ProductsView />,
    'admin-hr': <AdminHrView />,
    'service-requests': <ServiceRequestsView />,
    'hr-workspace': <HrWorkspaceView />,
    marketing: <MarketingWorkspaceView />,
    team: <TeamView />,
    customer: <CustomerPortalView />,
    about: <AboutView />,
    contact: <ContactView />,
    learning: <RoleAreaView area="intern" title="Learning" description="Intern learning resources" emptyTitle="No learning resources yet" emptyDescription="Resources will appear when shared by your team." />,
    projects: <RoleAreaView area="intern" title="Projects" description="Intern projects" emptyTitle="No projects yet" emptyDescription="Projects will appear when assigned by your team." />,
    work: <RoleAreaView area="employee" title="My work" description="Employee work and projects" emptyTitle="No work items yet" emptyDescription="Work items will appear when assigned by your team." />,
    documents: <RoleAreaView area="employee" title="Documents" description="Employee documents" emptyTitle="No documents yet" emptyDescription="Documents will appear when shared by your team." />,
  };

  const featureBackground = ['chat', 'calls', 'statuses'].includes(slug) ? chatPalette[theme].panel : colors.canvas;

  return (
    <SafeAreaView edges={slug === 'calls' || slug === 'statuses' ? ['top', 'bottom'] : ['bottom']} style={{ flex: 1, backgroundColor: featureBackground }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="min-w-0 flex-1 w-full web:mx-auto web:max-w-[1200px]">
        {screens[slug] ?? <FeatureDataView feature={feature} />}
      </View>
    </SafeAreaView>
  );
}