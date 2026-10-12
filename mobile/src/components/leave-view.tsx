import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { colors, spacing } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type LeaveType = 'EARNED' | 'SICK' | 'CASUAL';
type LeaveRequest = { id?: string; _id?: string; type: LeaveType; startDate: string; endDate: string; reason: string; status: string };

export function LeaveView() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [type, setType] = useState<LeaveType>('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const payload = await workspaceService.leave() as { leave?: { requests?: LeaveRequest[] } };
    setRequests(payload.leave?.requests ?? []);
  };
  useEffect(() => { void Promise.resolve().then(load).catch(() => undefined); }, []);

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || reason.trim().length < 2) {
      Alert.alert('Leave request', 'Use YYYY-MM-DD dates and include a reason.'); return;
    }
    setBusy(true);
    try {
      await workspaceService.createLeave({ type, startDate, endDate, reason: reason.trim() });
      setReason(''); await load();
    } catch (error) { Alert.alert('Leave request', getApiErrorMessage(error, 'Unable to submit request.')); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Time away" title="Leave" description="Submit a request and track its approval status." />
      <View style={styles.segment}>{(['EARNED', 'SICK', 'CASUAL'] as const).map((item) => <Pressable key={item} onPress={() => setType(item)} style={[styles.segmentItem, type === item && styles.segmentActive]}><Text style={[styles.segmentText, type === item && styles.segmentTextActive]}>{item}</Text></Pressable>)}</View>
      <View style={styles.dates}><TextInput onChangeText={setStartDate} placeholder="Start YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} value={startDate} /><TextInput onChangeText={setEndDate} placeholder="End YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} value={endDate} /></View>
      <TextInput multiline onChangeText={setReason} placeholder="Reason" placeholderTextColor={colors.muted} style={[styles.input, styles.reason]} value={reason} />
      <Pressable disabled={busy} onPress={submit} style={styles.button}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Submit request</Text>}</Pressable>
      <Text style={styles.section}>Recent requests</Text>
      {requests.map((request, index) => <View key={request.id ?? request._id ?? index} style={styles.card}><View><Text style={styles.cardTitle}>{request.type}</Text><Text style={styles.cardDates}>{request.startDate} to {request.endDate}</Text></View><Text style={styles.status}>{request.status}</Text></View>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48, gap: 12 }, kicker: { color: colors.brand, fontSize: 12, fontWeight: '800' }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginBottom: spacing.sm },
  segment: { height: 46, flexDirection: 'row', padding: 3, borderRadius: 6, backgroundColor: '#E9ECE7' }, segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4 }, segmentActive: { backgroundColor: colors.surface }, segmentText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, segmentTextActive: { color: colors.ink },
  dates: { gap: 10 }, input: { minHeight: 50, paddingHorizontal: spacing.md, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, color: colors.ink }, reason: { minHeight: 90, paddingTop: 14, textAlignVertical: 'top' },
  button: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.brand }, buttonText: { color: colors.white, fontWeight: '800' }, section: { color: colors.ink, fontSize: 18, fontWeight: '800', marginTop: spacing.lg },
  card: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, cardTitle: { color: colors.ink, fontWeight: '800' }, cardDates: { color: colors.muted, marginTop: 4 }, status: { color: colors.teal, fontSize: 11, fontWeight: '900' },
});