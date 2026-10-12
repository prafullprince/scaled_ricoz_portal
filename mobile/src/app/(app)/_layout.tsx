import { Tabs } from 'expo-router';

import { DashboardShell } from '@/components/dashboard-shell';
import { colors } from '@/constants/theme';

export default function AppLayout() {
  return (
    <DashboardShell>
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarStyle: { display: 'none' },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Overview' }}
      />
      <Tabs.Screen
        name="workspace"
        options={{ title: 'Workspace' }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{ title: 'First Chat' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />
      <Tabs.Screen name="feature/[slug]" options={{ href: null }} />
      <Tabs.Screen name="chat/[conversationId]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
    </DashboardShell>
  );
}