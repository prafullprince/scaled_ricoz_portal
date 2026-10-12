import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader } from '@/components/ui/primitives';
import { colors, spacing } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { recruitmentService } from '@/services/recruitment.service';
import { useAppSelector } from '@/store/hooks';
import type { Application, ApplicationInput, Opportunity, ResumeAsset } from '@/types/recruitment';

type Tab = 'opportunities' | 'applications';

export function RecruitmentView({ initialTab = 'opportunities' }: { initialTab?: Tab }) {
  const roles = useAppSelector((state) => state.auth.user?.roles ?? []);
  const canApply = !roles.some((role) => ['CUSTOMER', 'INVESTOR', 'ADMIN'].includes(role));
  const [tab, setTab] = useState<Tab>(initialTab);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [address, setAddress] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [resume, setResume] = useState<ResumeAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [nextOpportunities, nextApplications] = await Promise.all([
        recruitmentService.opportunities(),
        recruitmentService.applications(),
      ]);
      setOpportunities(nextOpportunities);
      setApplications(nextApplications);
    } catch (error) {
      Alert.alert('Recruitment', getApiErrorMessage(error, 'Unable to load recruitment data.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void Promise.resolve().then(load).catch(() => undefined); }, []);

  const pickResume = async () => {
    try { setResume(await recruitmentService.pickResume()); }
    catch (error) { Alert.alert('Resume', getApiErrorMessage(error, 'Unable to select the resume.')); }
  };

  const apply = async () => {
    if (!selected || address.trim().length < 5) {
      Alert.alert('Application', 'Enter your full address before submitting.');
      return;
    }
    const input: ApplicationInput = { address, coverLetter, linkedInUrl, portfolioUrl, githubUrl, resume };
    setBusy(true);
    try {
      await recruitmentService.apply(selected._id, input);
      setSelected(null);
      setAddress(''); setCoverLetter(''); setLinkedInUrl(''); setPortfolioUrl(''); setGithubUrl(''); setResume(null);
      await load();
      setTab('applications');
      Alert.alert('Application submitted', 'You can track its status here.');
    } catch (error) {
      Alert.alert('Application', getApiErrorMessage(error, 'Unable to submit your application.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="bg-canvas" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Careers" title="Opportunities" description="Explore open roles and follow every application." />
      <View style={styles.segment}>
        {(['opportunities', 'applications'] as const).map((item) => (
          <Pressable key={item} onPress={() => { setTab(item); setSelected(null); }} style={[styles.segmentItem, tab === item && styles.segmentActive]}>
            <Text style={[styles.segmentText, tab === item && styles.segmentTextActive]}>{item === 'opportunities' ? 'OPEN ROLES' : 'MY APPLICATIONS'}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator color={colors.brand} style={styles.loader} /> : null}
      {!loading && tab === 'opportunities' && !selected ? opportunities.map((opportunity) => (
        <View key={opportunity._id} style={styles.card}>
          <View style={styles.cardHeader}><Text style={styles.cardTitle}>{opportunity.title}</Text><Text style={styles.badge}>{opportunity.type}</Text></View>
          <Text style={styles.meta}>{opportunity.workMode}{opportunity.location ? ` · ${opportunity.location}` : ''}{opportunity.experience ? ` · ${opportunity.experience}` : ''}</Text>
          <Text numberOfLines={4} style={styles.body}>{opportunity.description}</Text>
          {canApply ? <Pressable onPress={() => setSelected(opportunity)} style={styles.primary}><Text style={styles.primaryText}>Apply</Text></Pressable> : null}
        </View>
      )) : null}
      {!loading && tab === 'applications' ? applications.map((application) => (
        <View key={application._id} style={styles.card}>
          <View style={styles.cardHeader}><Text style={styles.cardTitle}>{application.opportunityId.title}</Text><Text style={styles.status}>{application.status.replace('_', ' ')}</Text></View>
          <Text style={styles.meta}>Applied {new Date(application.appliedAt).toLocaleDateString()}</Text>
          {application.resumeFileName ? <Text style={styles.body}>Resume: {application.resumeFileName}</Text> : null}
          {application.offerStatus ? <Text style={styles.body}>Offer: {application.offerStatus}</Text> : null}
          {application.declineReason ? <Text style={styles.error}>{application.declineReason}</Text> : null}
        </View>
      )) : null}
      {!loading && ((tab === 'opportunities' && !selected && opportunities.length === 0) || (tab === 'applications' && applications.length === 0)) ? <Text style={styles.empty}>Nothing to show yet.</Text> : null}
      {selected ? (
        <View style={styles.form}>
          <View style={styles.cardHeader}><Text style={styles.formTitle}>Apply for {selected.title}</Text><Pressable onPress={() => setSelected(null)}><Text style={styles.cancel}>Cancel</Text></Pressable></View>
          <TextInput onChangeText={setAddress} placeholder="Full address *" placeholderTextColor={colors.muted} style={styles.input} value={address} />
          <TextInput multiline onChangeText={setCoverLetter} placeholder="Cover letter" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} value={coverLetter} />
          <TextInput autoCapitalize="none" keyboardType="url" onChangeText={setLinkedInUrl} placeholder="LinkedIn URL (https://...)" placeholderTextColor={colors.muted} style={styles.input} value={linkedInUrl} />
          <TextInput autoCapitalize="none" keyboardType="url" onChangeText={setPortfolioUrl} placeholder="Portfolio URL (https://...)" placeholderTextColor={colors.muted} style={styles.input} value={portfolioUrl} />
          <TextInput autoCapitalize="none" keyboardType="url" onChangeText={setGithubUrl} placeholder="GitHub URL (https://...)" placeholderTextColor={colors.muted} style={styles.input} value={githubUrl} />
          <Pressable onPress={pickResume} style={styles.secondary}><Text style={styles.secondaryText}>{resume?.name ?? 'Attach PDF resume'}</Text></Pressable>
          <Pressable disabled={busy} onPress={apply} style={styles.primary}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryText}>Submit application</Text>}</Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 48, gap: 12 }, kicker: { color: colors.brand, fontSize: 12, fontWeight: '800' }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginBottom: spacing.sm },
  segment: { height: 46, flexDirection: 'row', padding: 3, borderRadius: 6, backgroundColor: '#E9ECE7' }, segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 4 }, segmentActive: { backgroundColor: colors.surface }, segmentText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, segmentTextActive: { color: colors.ink }, loader: { marginTop: spacing.xl },
  card: { gap: 9, padding: spacing.md, borderRadius: 7, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }, cardTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '800' }, badge: { color: colors.teal, fontSize: 10, fontWeight: '900' }, status: { color: colors.brand, fontSize: 10, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 12 }, body: { color: colors.ink, fontSize: 14, lineHeight: 20 }, error: { color: colors.danger, fontSize: 13 }, empty: { color: colors.muted, paddingVertical: spacing.xl, textAlign: 'center' },
  form: { gap: 11, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.surface }, formTitle: { flex: 1, color: colors.ink, fontSize: 19, fontWeight: '800' }, cancel: { color: colors.danger, fontWeight: '800' }, input: { minHeight: 50, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: 6, color: colors.ink, backgroundColor: colors.paper }, multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: 'top' },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 6, backgroundColor: colors.brand }, primaryText: { color: colors.white, fontWeight: '800' }, secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.teal, borderRadius: 6 }, secondaryText: { color: colors.teal, fontWeight: '800' },
});
