import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { chatPalette, useChatTheme } from '@/providers/chat-theme';

const tabs = [
  { key: 'chat', label: 'Chats', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles', route: '/feature/chat' },
  { key: 'statuses', label: 'Status', icon: 'ellipse-outline', activeIcon: 'ellipse', route: '/feature/statuses' },
  { key: 'calls', label: 'Calls', icon: 'call-outline', activeIcon: 'call', route: '/feature/calls' },
] as const;

export function ChatBottomTabs({ active }: { active: (typeof tabs)[number]['key'] }) {
  const router = useRouter();
  const { theme } = useChatTheme();
  const colors = chatPalette[theme];

  return (
    <View className="flex-row border-t px-2 pb-1 pt-2" style={{ backgroundColor: colors.panel, borderColor: colors.line }}>
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="min-h-12 flex-1 items-center justify-center gap-0.5"
            onPress={() => router.replace(tab.route)}
          >
            <Ionicons color={selected ? colors.accent : colors.secondary} name={selected ? tab.activeIcon : tab.icon} size={21} />
            <Text className="font-semibold text-[10px]" style={{ color: selected ? colors.accent : colors.secondary }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}