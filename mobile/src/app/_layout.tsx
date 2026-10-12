import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/geist';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import '@/lib/livekit-setup';
import '../../global.css';

import { LoadingScreen } from '@/components/loading-screen';
import { CallProvider } from '@/providers/runtime-call-provider';
import { AppProvider } from '@/providers/app-provider';
import { ChatThemeProvider, useChatTheme } from '@/providers/chat-theme';
import { useAppSelector } from '@/store/hooks';

function RootNavigator() {
  const status = useAppSelector((state) => state.auth.status);
  const { theme } = useChatTheme();
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
  });

  if (status === 'checking' || !fontsLoaded) return <LoadingScreen />;

  const isAuthenticated = status === 'authenticated';
  return (
    <Suspense fallback={<LoadingScreen />}>
    <CallProvider>
    <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
    </CallProvider>
    </Suspense>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <ChatThemeProvider>
      <KeyboardProvider>
      <RootNavigator />
      </KeyboardProvider>
      </ChatThemeProvider>
    </AppProvider>
  );
}