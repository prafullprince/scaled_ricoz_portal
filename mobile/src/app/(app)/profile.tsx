import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, IconButton, PageHeader, PrimaryButton, SectionLabel, Surface } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { authService } from '@/services/auth.service';
import { clearSession, setSession, setUser } from '@/store/auth.slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';

type AccountSession = { id: string; created_at: string; current: boolean };

export default function ProfileScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [name, setName] = useState(user?.user_name ?? '');
  const [phone, setPhone] = useState(user?.phone_number ?? '');
  const [about, setAbout] = useState(user?.user_about ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [busy, setBusy] = useState(false);

  const loadSessions = async () => setSessions(await authService.sessions());
  useEffect(() => { void Promise.resolve().then(loadSessions).catch(() => undefined); }, []);

  const saveProfile = async () => {
    if (name.trim().length < 3) { Alert.alert('Profile', 'Name must contain at least 3 characters.'); return; }
    setBusy(true);
    try {
      const nextUser = await authService.updateProfile({ user_name: name.trim(), phone_number: phone.trim(), user_about: about.trim() });
      dispatch(setUser(nextUser)); Alert.alert('Profile updated');
    } catch (error) { Alert.alert('Profile', getApiErrorMessage(error, 'Unable to update your profile.')); }
    finally { setBusy(false); }
  };

  const updatePassword = async () => {
    if (currentPassword.length < 8 || newPassword.length < 8 || currentPassword === newPassword) {
      Alert.alert('Password', 'Use at least 8 characters and choose a different new password.'); return;
    }
    setBusy(true);
    try {
      const session = await authService.changePassword(currentPassword, newPassword);
      dispatch(setSession({ accessToken: session.access_token, user: session.user }));
      setCurrentPassword(''); setNewPassword(''); await loadSessions();
      Alert.alert('Password updated', 'Other signed-in devices have been disconnected.');
    } catch (error) { Alert.alert('Password', getApiErrorMessage(error, 'Unable to update your password.')); }
    finally { setBusy(false); }
  };

  const revokeSession = (sessionId: string) => Alert.alert('Revoke session?', 'That device will need to sign in again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Revoke', style: 'destructive', onPress: async () => {
      try { await authService.revokeSession(sessionId); await loadSessions(); }
      catch (error) { Alert.alert('Sessions', getApiErrorMessage(error, 'Unable to revoke the session.')); }
    } },
  ]);

  const handleLogoutAll = () => Alert.alert('Sign out everywhere?', 'Every active session, including this device, will be revoked.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out all', style: 'destructive', onPress: async () => { await authService.logoutAll(); dispatch(clearSession()); } },
  ]);

  const handleLogout = () => Alert.alert('Sign out?', 'This removes the secure session from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await authService.logout(); dispatch(clearSession()); } },
  ]);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="gap-4 px-5 pb-12 pt-5 web:mx-auto web:w-full web:max-w-2xl" keyboardShouldPersistTaps="handled">
        <PageHeader eyebrow="Account" title="Profile" action={<IconButton icon="log-out-outline" label="Sign out" onPress={handleLogout} />} />

        <View className="overflow-hidden rounded-card bg-ink p-5">
          <View className="absolute bottom-0 left-0 h-1 w-24 bg-coral" />
          <View className="flex-row items-center gap-4">
            <View className="h-16 w-16 items-center justify-center rounded-full border border-gray-600 bg-teal"><Text className="font-extra text-2xl text-white">{user?.user_name.charAt(0).toUpperCase()}</Text></View>
            <View className="flex-1 gap-1"><Text className="font-bold text-xl text-white">{user?.user_name}</Text><Text className="font-sans text-sm text-gray-400">{user?.user_email}</Text><Text className="mt-1 font-extra text-[10px] uppercase text-orange-300">{user?.organization_title ?? user?.roles.join(' · ')}</Text></View>
          </View>
        </View>

        <SectionLabel>Personal details</SectionLabel>
        <View className="gap-3">
          <Field icon="person-outline" onChangeText={setName} placeholder="Name" value={name} />
          <Field icon="call-outline" keyboardType="phone-pad" onChangeText={setPhone} placeholder="Phone number" value={phone} />
          <TextInput className="min-h-24 rounded-card border border-line bg-white px-4 py-3 font-medium text-[15px] text-ink" multiline onChangeText={setAbout} placeholder="About you" placeholderTextColor={colors.muted} textAlignVertical="top" value={about} />
          <PrimaryButton busy={busy} label="Save profile" onPress={saveProfile} />
        </View>

        <SectionLabel>Security</SectionLabel>
        <Surface className="gap-3">
          <View className="flex-row items-center gap-3 pb-1"><View className="h-9 w-9 items-center justify-center rounded-card bg-mint"><Ionicons color={colors.teal} name="key-outline" size={19} /></View><View className="flex-1"><Text className="font-bold text-sm text-ink">Change password</Text><Text className="font-sans text-xs text-muted">This signs out your other devices.</Text></View></View>
          <Field icon="lock-closed-outline" onChangeText={setCurrentPassword} placeholder="Current password" secureTextEntry value={currentPassword} />
          <Field icon="shield-checkmark-outline" onChangeText={setNewPassword} placeholder="New password" secureTextEntry value={newPassword} />
          <PrimaryButton busy={busy} label="Update password" onPress={updatePassword} tone="ink" />
        </Surface>

        <SectionLabel action={<IconButton icon="refresh" label="Refresh sessions" onPress={() => { void loadSessions(); }} />}>Active sessions</SectionLabel>
        <View className="gap-2">
          {sessions.map((session) => (
            <View key={session.id} className="min-h-16 flex-row items-center gap-3 rounded-card border border-line bg-white px-4 py-3">
              <View className="h-9 w-9 items-center justify-center rounded-card bg-paper"><Ionicons color={colors.ink} name="phone-portrait-outline" size={19} /></View>
              <View className="flex-1"><Text className="font-bold text-sm text-ink">Signed-in session</Text><Text className="font-sans text-[11px] text-muted">{new Date(session.created_at).toLocaleString()}</Text></View>
              <IconButton danger icon="close" label="Revoke session" onPress={() => revokeSession(session.id)} />
            </View>
          ))}
          {sessions.length === 0 ? <Text className="py-5 text-center font-sans text-sm text-muted">No refreshable sessions are currently listed.</Text> : null}
        </View>

        <Pressable className="mt-3 h-13 items-center justify-center rounded-card border border-red-200 bg-red-50 active:opacity-70" onPress={handleLogoutAll}><Text className="font-bold text-sm text-danger">Sign out on all devices</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
