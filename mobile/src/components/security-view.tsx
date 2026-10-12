import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { Field, IconButton, PageHeader, PrimaryButton, SectionLabel, Surface } from '@/components/ui/primitives';
import { EmptyHint, Loader } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { authService } from '@/services/auth.service';
import { clearSession, setSession } from '@/store/auth.slice';
import { useAppDispatch } from '@/store/hooks';

type AccountSession = { id: string; created_at: string; current: boolean };

export function SecurityView() {
  const dispatch = useAppDispatch();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadSessions = async () => {
    setSessions(await authService.sessions());
  };

  useEffect(() => {
    void Promise.resolve()
      .then(loadSessions)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const updatePassword = async () => {
    if (currentPassword.length < 8 || newPassword.length < 8 || currentPassword === newPassword) {
      Alert.alert('Password', 'Use at least 8 characters and choose a different new password.');
      return;
    }
    setBusy(true);
    try {
      const session = await authService.changePassword(currentPassword, newPassword);
      dispatch(setSession({ accessToken: session.access_token, user: session.user }));
      setCurrentPassword('');
      setNewPassword('');
      await loadSessions();
      Alert.alert('Password updated', 'Other signed-in devices have been disconnected.');
    } catch (error) {
      Alert.alert('Password', getApiErrorMessage(error, 'Unable to update your password.'));
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = (sessionId: string) =>
    Alert.alert('Revoke session?', 'That device will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await authService.revokeSession(sessionId);
            await loadSessions();
          } catch (error) {
            Alert.alert('Sessions', getApiErrorMessage(error, 'Unable to revoke the session.'));
          }
        },
      },
    ]);

  const logoutEverywhere = () =>
    Alert.alert('Sign out everywhere?', 'Every active session, including this device, will be revoked.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out all', style: 'destructive', onPress: async () => {
        try {
          await authService.logoutAll();
          dispatch(clearSession());
        } catch (error) {
          Alert.alert('Sessions', getApiErrorMessage(error, 'Unable to sign out all devices.'));
        }
      } },
    ]);

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4">
      <PageHeader eyebrow="My account" title="Security" description="Protect your account with a strong password and reviewed sessions." />

      <SectionLabel>Change password</SectionLabel>
      <Surface className="gap-3">
        <View className="flex-row items-center gap-3 pb-1">
          <View className="h-9 w-9 items-center justify-center rounded-card bg-mint"><Ionicons color="#176B68" name="key-outline" size={19} /></View>
          <Text className="flex-1 font-sans text-xs text-muted">Updating your password signs out every other device.</Text>
        </View>
        <Field icon="lock-closed-outline" onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry value={currentPassword} />
        <Field icon="shield-checkmark-outline" onChangeText={setNewPassword} placeholder="New password" secureTextEntry value={newPassword} />
        <PrimaryButton busy={busy} label="Update password" onPress={updatePassword} tone="ink" />
      </Surface>

      <SectionLabel action={<IconButton icon="refresh" label="Refresh sessions" onPress={() => { void loadSessions(); }} />}>Active sessions</SectionLabel>
      {loading ? <Loader color="#176B68" /> : null}
      <View className="gap-2">
        {sessions.map((session) => (
          <View key={session.id} className="min-h-16 flex-row items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
            <View className="h-9 w-9 items-center justify-center rounded-card bg-paper"><Ionicons color="#17212B" name="phone-portrait-outline" size={19} /></View>
            <View className="flex-1">
              <Text className="font-bold text-sm text-ink">{session.current ? 'This device' : 'Signed-in session'}</Text>
              <Text className="font-sans text-[11px] text-muted">{new Date(session.created_at).toLocaleString()}</Text>
            </View>
            <IconButton danger icon="close" label="Revoke session" onPress={() => revokeSession(session.id)} />
          </View>
        ))}
        {!loading && !sessions.length ? <EmptyHint description="Refreshable sessions will be listed here." icon="phone-portrait-outline" title="No sessions listed" /> : null}
      </View>

      <Pressable accessibilityRole="button" className="min-h-12 items-center justify-center rounded-card border border-red-200 bg-red-50 px-4 py-3 active:opacity-70" onPress={logoutEverywhere}>
        <Text className="text-center font-bold text-sm text-danger">Sign out on all devices</Text>
      </Pressable>
    </ScrollView>
  );
}
