import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { colors, spacing } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { investorService, type InvestorSubmission, type InvestorVerification } from '@/services/investor.service';
import { useAppSelector } from '@/store/hooks';

export function InvestorVerificationView() {
  const isAdmin = useAppSelector((state) => state.auth.user?.roles.includes('ADMIN') ?? false);
  const [verification, setVerification] = useState<InvestorVerification | null>(null);
  const [submissions, setSubmissions] = useState<InvestorSubmission[]>([]);
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isAdmin) setSubmissions(await investorService.queue());
      else {
        const result = await investorService.mine();
        setVerification(result); setLinkedInUrl(result.linked_in_url ?? '');
      }
    } catch (error) { Alert.alert('Investor verification', getApiErrorMessage(error, 'Unable to load verification data.')); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { void Promise.resolve().then(load).catch(() => undefined); }, [load]);

  const submit = async () => {
    if (!/^https:\/\/\S+$/i.test(linkedInUrl.trim())) { Alert.alert('LinkedIn profile', 'Enter a valid URL beginning with https://.'); return; }
    setBusy(true);
    try { setVerification(await investorService.submit(linkedInUrl.trim())); Alert.alert('Submitted for verification'); }
    catch (error) { Alert.alert('Investor verification', getApiErrorMessage(error, 'Unable to submit your profile.')); }
    finally { setBusy(false); }
  };

  const review = async (userId: string, action: 'approve' | 'reject') => {
    const reason = rejectionReasons[userId]?.trim() ?? '';
    if (action === 'reject' && !reason) { Alert.alert('Rejection reason', 'Enter a reason before rejecting.'); return; }
    setBusy(true);
    try {
      if (action === 'approve') await investorService.approve(userId);
      else await investorService.reject(userId, reason);
      setRejectionReasons((current) => ({ ...current, [userId]: '' })); await load();
    } catch (error) { Alert.alert('Investor review', getApiErrorMessage(error, `Unable to ${action} this investor.`)); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Investor access" title={isAdmin ? 'Verification queue' : 'Verification'} description={isAdmin ? 'Review investor profiles awaiting a decision.' : 'Submit your professional profile for investor access.'} />
      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
      {!isAdmin && verification ? (
        <>
          <View style={styles.statusCard}><Text style={styles.status}>{verification.status}</Text><Text style={styles.body}>{verification.status === 'REJECTED' ? verification.rejection_reason ?? 'Update your profile and resubmit.' : verification.status === 'PENDING' ? 'Your profile is being reviewed.' : `Verified ${verification.verified_at ? new Date(verification.verified_at).toLocaleDateString() : ''}`}</Text></View>
          <TextInput autoCapitalize="none" keyboardType="url" onChangeText={setLinkedInUrl} placeholder="https://www.linkedin.com/in/..." placeholderTextColor={colors.muted} style={styles.input} value={linkedInUrl} />
          <Pressable disabled={busy} onPress={submit} style={styles.primary}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Submit for verification</Text>}</Pressable>
        </>
      ) : null}
      {isAdmin && !loading && submissions.length === 0 ? <Text style={styles.empty}>No investor submissions are awaiting review.</Text> : null}
      {isAdmin ? submissions.map((submission) => (
        <View key={submission.user_id} style={styles.card}>
          <View><Text style={styles.cardTitle}>{submission.name}</Text><Text style={styles.meta}>{submission.email}</Text></View>
          {submission.linked_in_url ? <Pressable onPress={() => Linking.openURL(submission.linked_in_url!)}><Text style={styles.link}>Open LinkedIn profile</Text></Pressable> : null}
          <TextInput onChangeText={(value) => setRejectionReasons((current) => ({ ...current, [submission.user_id]: value }))} placeholder="Reason if rejecting" placeholderTextColor={colors.muted} style={styles.input} value={rejectionReasons[submission.user_id] ?? ''} />
          <View style={styles.actions}><Pressable disabled={busy} onPress={() => review(submission.user_id, 'reject')} style={styles.reject}><Text style={styles.rejectText}>Reject</Text></Pressable><Pressable disabled={busy} onPress={() => review(submission.user_id, 'approve')} style={[styles.primary, styles.action]}><Text style={styles.primaryText}>Approve</Text></Pressable></View>
        </View>
      )) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48, gap: 12 }, kicker: { color: colors.brand, fontSize: 12, fontWeight: '800' }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginBottom: spacing.sm }, loader: { marginTop: spacing.xl },
  statusCard: { gap: 8, padding: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.teal, backgroundColor: colors.surface }, status: { color: colors.teal, fontSize: 13, fontWeight: '900' }, body: { color: colors.ink, lineHeight: 20 },
  input: { minHeight: 50, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 6, color: colors.ink, backgroundColor: colors.surface }, primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 6, backgroundColor: colors.brand }, primaryText: { color: colors.white, fontWeight: '800' },
  card: { gap: 11, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface }, cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' }, meta: { color: colors.muted, marginTop: 3 }, link: { color: colors.teal, fontWeight: '800' }, actions: { flexDirection: 'row', gap: 10 }, action: { flex: 1 }, reject: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.danger, borderRadius: 6 }, rejectText: { color: colors.danger, fontWeight: '800' }, empty: { color: colors.muted, paddingVertical: spacing.xl, textAlign: 'center' },
});
