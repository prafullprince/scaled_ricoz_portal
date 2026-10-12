import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps, type PropsWithChildren } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { featuresForUser } from '@/features/registry';
import { isStandaloneChatRoute } from '@/features/dashboard-model';
import { DashboardDepartmentContext } from '@/providers/dashboard-department';
import { chatPalette, useChatTheme } from '@/providers/chat-theme';
import { authService } from '@/services/auth.service';
import { chatService } from '@/services/chat.service';
import { notificationsService } from '@/services/notifications.service';
import { clearSession } from '@/store/auth.slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

type IconName = ComponentProps<typeof Ionicons>['name'];
const groups = [
  { title: 'Workspace', slugs: ['dashboard', 'employee', 'intern', 'sales', 'marketing', 'hr-workspace', 'customer', 'investor'] },
  { title: 'My work', slugs: ['tasks', 'calendar', 'attendance', 'leave', 'planner', 'goals', 'performance', 'task-report', 'work', 'projects', 'documents', 'learning'] },
  { title: 'Team & organization', slugs: ['team', 'task-reports', 'organization', 'users-base', 'companies', 'products'] },
  { title: 'Administration', slugs: ['admin', 'admin-hr', 'onboarding', 'recruitment-admin', 'service-requests', 'compliance'] },
  { title: 'Communication', slugs: ['chat', 'calls', 'statuses', 'assistant'] },
  { title: 'Personal', slugs: ['notifications', 'settings', 'security', 'applications', 'recruitment'] },
  { title: 'Ricoz', slugs: ['services', 'about', 'contact', 'analytics'] },
];
const departments: { id: string; label: string; icon: IconName }[] = [
  { id: 'PRODUCT', label: 'Product', icon: 'cube-outline' },
  { id: 'MARKETING', label: 'Marketing', icon: 'megaphone-outline' },
  { id: 'FINANCE', label: 'Finance', icon: 'wallet-outline' },
  { id: 'SALES', label: 'Sales', icon: 'trending-up-outline' },
  { id: 'PROJECTS', label: 'Projects', icon: 'folder-outline' },
  { id: 'SUPPORT', label: 'Support', icon: 'headset-outline' },
  { id: 'HR', label: 'HR', icon: 'people-outline' },
  { id: 'DESIGN', label: 'Design', icon: 'color-palette-outline' },
  { id: 'ENGINEERING', label: 'Engineering', icon: 'code-slash-outline' },
];

export function DashboardShell({ children }: PropsWithChildren) {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { theme } = useChatTheme();
  const standaloneChat = isStandaloneChatRoute(pathname);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  const executive = Boolean(user?.roles.some((role) => role === 'ADMIN' || role === 'CEO'));
  const [department, setDepartment] = useState<string>();
  const [hoveredDepartment, setHoveredDepartment] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notifications, setNotifications] = useState(0);
  const [unread, setUnread] = useState(0);
  const workspaceDepartment = executive ? department : user?.organization_department;
  const features = featuresForUser(user && executive && department ? { ...user, organization_department: department } : user);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const [noticeResult, chatResult] = await Promise.allSettled([notificationsService.list(), chatService.unreadCount()]);
      if (!active) return;
      if (noticeResult.status === 'fulfilled') setNotifications(noticeResult.value.unread);
      if (chatResult.status === 'fulfilled') setUnread(chatResult.value);
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [pathname]);

  const navigate = (slug: string) => {
    setMenuOpen(false);
    if (slug === 'dashboard') router.push('/');
    else if (slug === 'profile') router.push('/profile');
    else if (slug === 'chat') router.push('/chat');
    else router.push({ pathname: '/feature/[slug]', params: { slug } });
  };
  const signOut = () => Alert.alert('Sign out?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { try { await authService.logout(); } catch { Alert.alert('Signed out on this device', 'The server could not be reached to revoke the remote session.'); } finally { dispatch(clearSession()); } } }]);
  const isActive = (slug: string) => slug === 'dashboard' ? pathname === '/' : slug === 'chat' ? pathname === '/chat' : pathname === `/feature/${slug}`;
  const navigation = (
    <View className="flex-1" style={{ backgroundColor: '#fbfbfc' }}>
      <View className="min-h-20 flex-row items-center gap-3 px-5"><View className="h-9 w-9 items-center justify-center rounded-card bg-coral"><Ionicons name="apps-outline" size={21} color="white" /></View><View className="flex-1"><Text className="font-bold text-lg text-ink">Ricoz<Text className="text-coral">.</Text></Text><Text className="font-sans text-[11px] text-muted">{workspaceDepartment ? `${workspaceDepartment.charAt(0)}${workspaceDepartment.slice(1).toLowerCase()} workspace` : 'Personal workspace'}</Text></View>{!wide ? <HeaderButton icon="close" label="Close navigation" onPress={() => setMenuOpen(false)} /> : null}</View>
      <View className="mx-4 mb-5 min-h-10 flex-row items-center gap-2 rounded-card border border-line bg-white px-3"><Ionicons name="search-outline" size={16} color={colors.muted} /><TextInput className="min-h-10 flex-1 font-sans text-xs text-ink" placeholder="Find a page..." placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} />{search ? <Pressable accessibilityLabel="Clear page search" onPress={() => setSearch('')}><Ionicons name="close" size={16} color={colors.muted} /></Pressable> : null}</View>
      <ScrollView contentContainerClassName="gap-5 px-3 pb-5">
        {groups.map((group) => {
          const items = group.slugs.flatMap((slug) => features.filter((feature) => feature.slug === slug)).filter((feature) => `${group.title} ${feature.title}`.toLowerCase().includes(search.trim().toLowerCase()));
          if (!items.length) return null;
          return <View key={group.title} className="gap-1"><Text className="mb-1 px-3 font-medium text-[11px] text-muted">{group.title}</Text>{items.map((feature) => {
            const selected = isActive(feature.slug);
            return <Pressable key={feature.slug} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => navigate(feature.slug)} className={`min-h-10 flex-row items-center gap-3 rounded-card px-3 py-2 ${selected ? 'bg-red-50' : ''}`}><Ionicons name={feature.icon} size={18} color={selected ? colors.brand : colors.muted} /><Text className={`flex-1 font-medium text-[13px] ${selected ? 'text-coral' : 'text-muted'}`}>{feature.slug === 'dashboard' ? 'Overview' : feature.slug === 'chat' ? 'First Chat' : feature.title}</Text>{feature.slug === 'chat' && unread > 0 ? <Badge count={unread} /> : null}{selected ? <View className="h-1.5 w-1.5 rounded-full bg-coral" /> : null}</Pressable>;
          })}</View>;
        })}
      </ScrollView>
      <View className="border-t border-line px-5 py-4"><Pressable onPress={() => navigate('settings')} className="flex-row items-center gap-3"><View className="h-8 w-8 items-center justify-center rounded-full border border-line bg-white"><Text className="font-semibold text-xs text-ink">{user?.user_name.slice(0, 1)}</Text></View><View className="flex-1"><Text className="font-semibold text-xs text-ink">{user?.user_name}</Text><Text className="mt-1 font-sans text-[11px] text-muted">Account settings</Text></View><HeaderButton icon="log-out-outline" label="Sign out" onPress={signOut} /></Pressable></View>
    </View>
  );

  if (standaloneChat) {
    return <DashboardDepartmentContext.Provider value={{ department, setDepartment }}><View className="flex-1" style={{ backgroundColor: chatPalette[theme].panel }}>{children}</View></DashboardDepartmentContext.Provider>;
  }

  return <DashboardDepartmentContext.Provider value={{ department, setDepartment }}><View className="flex-1 flex-row bg-canvas">
    {wide && executive ? <SafeAreaView edges={['top', 'bottom']} className="z-30 w-16 items-center gap-2 border-r border-line bg-white py-4">
      <Pressable accessibilityLabel="Personal overview" onPress={() => { setDepartment(undefined); navigate('dashboard'); }} className={`h-10 w-10 items-center justify-center rounded-card ${!department ? 'bg-red-50' : ''}`}><Ionicons name="grid-outline" size={21} color={!department ? colors.brand : colors.muted} /></Pressable>
      {departments.map((item) => <View key={item.id} className="relative"><Pressable accessibilityLabel={`${item.label} department`} accessibilityState={{ selected: department === item.id }} onPress={() => { setDepartment(item.id); navigate('dashboard'); }} onHoverIn={() => setHoveredDepartment(item.id)} onHoverOut={() => setHoveredDepartment(undefined)} className={`h-10 w-10 items-center justify-center rounded-card ${department === item.id ? 'bg-red-50' : ''}`}><Ionicons name={item.icon} size={20} color={department === item.id ? colors.brand : colors.muted} /></Pressable>{hoveredDepartment === item.id ? <View pointerEvents="none" className="absolute left-12 top-2 z-50 rounded-card bg-ink px-3 py-2"><Text className="font-medium text-xs text-white">{item.label}</Text></View> : null}</View>)}
    </SafeAreaView> : null}
    {wide ? <SafeAreaView edges={['top', 'bottom']} className="w-64 border-r border-line">{navigation}</SafeAreaView> : null}
    <View className="flex-1">
      <SafeAreaView edges={['top']} className="border-b border-line bg-white"><View className="min-h-16 flex-row items-center justify-between gap-3 px-4">
        <View className="flex-1 flex-row items-center gap-2">{!wide ? <HeaderButton icon="menu-outline" label="Open navigation menu" onPress={() => setMenuOpen(true)} /> : null}<Pressable onPress={() => navigate('dashboard')}><Text className="font-semibold text-base text-ink">{wide ? 'Dashboard' : 'Ricoz'}{!wide ? <Text className="text-coral">.</Text> : null}</Text></Pressable></View>
        <View className="flex-row items-center gap-1"><HeaderButton icon="calendar-outline" label="Daily planner" onPress={() => navigate('planner')} /><HeaderButton icon="notifications-outline" label={`Notifications, ${notifications} unread`} count={notifications} onPress={() => navigate('notifications')} /><HeaderButton icon="chatbubble-outline" label="First Chat" count={unread} onPress={() => navigate('chat')} /><Pressable accessibilityLabel="My profile" onPress={() => navigate('profile')} className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-paper"><Text className="font-semibold text-xs text-ink">{user?.user_name.slice(0, 1)}</Text></Pressable></View>
      </View></SafeAreaView>
      {children}
    </View>
    <Modal animationType="fade" transparent visible={menuOpen && !wide} onRequestClose={() => setMenuOpen(false)}><View className="flex-1 flex-row bg-black/40"><SafeAreaView edges={['top', 'bottom']} style={{ width: Math.min(320, width - 40), backgroundColor: '#fbfbfc' }}>{navigation}</SafeAreaView><Pressable accessibilityLabel="Close navigation overlay" className="flex-1" onPress={() => setMenuOpen(false)} /></View></Modal>
  </View></DashboardDepartmentContext.Provider>;
}

function HeaderButton({ icon, label, onPress, count = 0 }: { icon: IconName; label: string; onPress: () => void; count?: number }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="h-9 w-9 items-center justify-center rounded-card"><Ionicons name={icon} size={20} color={colors.muted} />{count > 0 ? <View className="absolute -right-0.5 -top-0.5"><Badge count={count} /></View> : null}</Pressable>;
}
function Badge({ count }: { count: number }) {
  return <View className="min-w-4 items-center rounded-full bg-coral px-1"><Text className="font-bold text-[9px] text-white">{count > 99 ? '99+' : count}</Text></View>;
}