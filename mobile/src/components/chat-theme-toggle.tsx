import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { chatPalette, useChatTheme } from '@/providers/chat-theme';

export function ChatThemeToggle() {
  const { theme, setTheme } = useChatTheme();
  const colors = chatPalette[theme];

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Chat appearance" className="h-10 flex-row items-center gap-1 rounded-full border p-1" style={{ backgroundColor: colors.raised, borderColor: colors.line }}>
      <Pressable accessibilityRole="radio" accessibilityLabel="Light mode" accessibilityState={{ checked: theme === 'light' }} className="h-8 w-8 items-center justify-center rounded-full" onPress={() => setTheme('light')} style={{ backgroundColor: theme === 'light' ? colors.panel : 'transparent' }}>
        <Ionicons color={theme === 'light' ? colors.accent : colors.secondary} name="sunny-outline" size={19} />
      </Pressable>
      <Pressable accessibilityRole="radio" accessibilityLabel="Dark mode" accessibilityState={{ checked: theme === 'dark' }} className="h-8 w-8 items-center justify-center rounded-full" onPress={() => setTheme('dark')} style={{ backgroundColor: theme === 'dark' ? colors.panel : 'transparent' }}>
        <Ionicons color={theme === 'dark' ? colors.accent : colors.secondary} name="moon-outline" size={18} />
      </Pressable>
    </View>
  );
}