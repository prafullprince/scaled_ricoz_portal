import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { colors, spacing } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { organizationService, type OrganizationLevel, type OrganizationUser } from '@/services/organization.service';
import { useAppSelector } from '@/store/hooks';

const levels: OrganizationLevel[] = ['CEO', 'HEAD', 'MANAGER', 'MEMBER'];
const departments = ['PRODUCT', 'MARKETING', 'FINANCE', 'SALES', 'PROJECTS', 'SUPPORT', 'HR', 'DESIGN', 'ENGINEERING'];

export function OrganizationView({ adminOnly = false }: { adminOnly?: boolean }) {
  const isAdmin = useAppSelector((state) => state.auth.user?.roles.includes('ADMIN') ?? false);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [level, setLevel] = useState<OrganizationLevel>('MEMBER');
  const [department, setDepartment] = useState('PRODUCT');
  const [memberRole, setMemberRole] = useState<'INTERN' | 'EMPLOYEE'>('EMPLOYEE');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(adminOnly ? await organizationService.promotableUsers() : await organizationService.users(search)); }
    catch (error) { Alert.alert('Organization', getApiErrorMessage(error, 'Unable to load users.')); }
  }, [adminOnly, search]);
  useEffect(() => { void Promise.resolve().then(load).catch(() => undefined); }, [load]);
  const submit = async () => {
    if (!selectedUserId) { Alert.alert('Organization', 'Select a user first.'); return; }
    setBusy(true);
    try {
      if (adminOnly) await organizationService.promote(selectedUserId, memberRole);
      else await organizationService.assign({ userId: selectedUserId, level, department, ...(level === 'MEMBER' ? { memberRole } : {}) });
      setSelectedUserId(''); await load(); Alert.alert('Organization updated');
    } catch (error) { Alert.alert('Organization', getApiErrorMessage(error, 'Unable to update this user.')); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="People" title={adminOnly ? 'Promote users' : 'Organization'} description={adminOnly ? 'Move eligible accounts into active contributor roles.' : 'Shape reporting lines and department ownership.'} />
      {!adminOnly ? <TextInput onChangeText={setSearch} placeholder="Search people" placeholderTextColor={colors.muted} style={styles.input} value={search} /> : null}
      <Text style={styles.label}>Select user</Text>
      <View style={styles.userList}>{users.map((user) => <Pressable key={user._id} onPress={() => setSelectedUserId(user._id)} style={[styles.user, selectedUserId === user._id && styles.userActive]}><View><Text style={styles.userName}>{user.name}</Text><Text style={styles.meta}>{user.email}</Text></View><Text style={styles.roles}>{user.roles.join(' · ')}</Text></Pressable>)}</View>
      {users.length === 0 ? <Text style={styles.empty}>No eligible users found.</Text> : null}
      {!adminOnly ? <><Text style={styles.label}>Organization level</Text><View style={styles.wrap}>{levels.map((item) => <Pressable key={item} onPress={() => setLevel(item)} style={[styles.choice, level === item && styles.choiceActive]}><Text style={[styles.choiceText, level === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}</View><Text style={styles.label}>Department</Text><View style={styles.wrap}>{departments.map((item) => <Pressable key={item} onPress={() => setDepartment(item)} style={[styles.choice, department === item && styles.choiceActive]}><Text style={[styles.choiceText, department === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}</View></> : null}
      {(adminOnly || level === 'MEMBER') ? <><Text style={styles.label}>{adminOnly ? 'Promote as' : 'Member role'}</Text><View style={styles.twoChoices}>{(['EMPLOYEE', 'INTERN'] as const).map((item) => <Pressable key={item} onPress={() => setMemberRole(item)} style={[styles.choice, styles.flexChoice, memberRole === item && styles.choiceActive]}><Text style={[styles.choiceText, memberRole === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}</View></> : null}
      <Pressable disabled={busy || !selectedUserId || (adminOnly && !isAdmin)} onPress={submit} style={styles.primary}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>{adminOnly ? 'Promote user' : 'Assign role'}</Text>}</Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48, gap: 12 }, kicker: { color: colors.brand, fontSize: 12, fontWeight: '800' }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginBottom: spacing.sm }, input: { minHeight: 50, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 6, color: colors.ink, backgroundColor: colors.surface },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: spacing.sm }, userList: { gap: 8 }, user: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface }, userActive: { borderColor: colors.brand, borderWidth: 2 }, userName: { color: colors.ink, fontWeight: '800' }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 }, roles: { maxWidth: '35%', color: colors.teal, fontSize: 10, fontWeight: '800', textAlign: 'right' }, empty: { color: colors.muted, textAlign: 'center', padding: spacing.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, twoChoices: { flexDirection: 'row', gap: 8 }, choice: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 5, backgroundColor: colors.surface }, flexChoice: { flex: 1 }, choiceActive: { borderColor: colors.teal, backgroundColor: colors.teal }, choiceText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, choiceTextActive: { color: colors.white }, primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.brand }, primaryText: { color: colors.white, fontWeight: '800' },
});
