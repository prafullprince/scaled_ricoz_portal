import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PageHeader, SectionLabel, Surface } from '@/components/ui/primitives';
import { EmptyHint } from '@/components/ui/view-kit';
import { useAppSelector } from '@/store/hooks';

const links = [
  { slug: 'security', icon: 'shield-checkmark-outline' as const, title: 'Security', description: 'Password, active sessions and sign-out.' },
  { slug: 'notifications', icon: 'notifications-outline' as const, title: 'Notifications', description: 'Read and clear workspace alerts.' },
  { slug: 'profile', icon: 'person-outline' as const, title: 'Profile', description: 'Update your personal details.' },
];

export function SettingsView() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="My account" title="Settings" description="Manage your account preferences." />

      <Surface className="gap-3">
        <View className="gap-1">
          <Text className="font-extra text-[11px] uppercase text-coral">Account</Text>
          <Text className="font-bold text-[17px] text-ink">{user?.user_name}</Text>
          <Text className="font-sans text-[13px] text-muted">{user?.user_email}</Text>
          <Text className="font-sans text-[13px] text-muted">{user?.organization_title ?? user?.roles.join(' · ')}</Text>
        </View>
        <Pressable className="h-11 items-center justify-center rounded-card bg-ink active:opacity-80" onPress={() => router.push('/profile')}>
          <Text className="font-bold text-[13px] text-white">Edit profile</Text>
        </Pressable>
      </Surface>

      <SectionLabel>Account tools</SectionLabel>
      <View className="gap-2.5">
        {links.map((link) => (
          <Pressable
            key={link.slug}
            className="flex-row items-center gap-3 rounded-card border border-line bg-white px-4 py-3.5 active:bg-paper"
            onPress={() => (link.slug === 'profile' ? router.push('/profile') : router.push({ pathname: '/feature/[slug]', params: { slug: link.slug } }))}
          >
            <View className="h-9 w-9 items-center justify-center rounded-card bg-mint">
              <Ionicons color="#176B68" name={link.icon} size={19} />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-ink">{link.title}</Text>
              <Text className="font-sans text-xs text-muted">{link.description}</Text>
            </View>
            <Ionicons color="#667085" name="arrow-forward" size={17} />
          </Pressable>
        ))}
      </View>

      <SectionLabel>Preferences</SectionLabel>
      <EmptyHint description="Notification and account preferences will appear here once available." icon="options-outline" title="No additional preferences yet" />
    </ScrollView>
  );
}
