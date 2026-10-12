import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { Field, PageHeader, PrimaryButton } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, TabBar } from '@/components/ui/view-kit';
import { getApiErrorMessage } from '@/services/api';
import { recruitmentService } from '@/services/recruitment.service';
import { useAppSelector } from '@/store/hooks';
import type { Application, Opportunity } from '@/types/recruitment';

export function RecruitmentAdminView() {
  const user = useAppSelector((state) => state.auth.user);
  const canManage = Boolean(user?.roles.includes('ADMIN') || user?.permissions?.includes('RECRUITMENT_ADMIN'));
  const canReview = Boolean(user?.roles.includes('ADMIN') || user?.permissions?.includes('RECRUITMENT_REVIEW'));
  const [tab, setTab] = useState(canManage ? 'openings' : 'applications');
  const [openings, setOpenings] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [type, setType] = useState<'JOB' | 'INTERNSHIP'>('JOB');
  const [workMode, setWorkMode] = useState<'REMOTE' | 'ONSITE' | 'HYBRID'>('REMOTE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [salary, setSalary] = useState('');
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError('');
      try {
        const [nextOpenings, nextApplications] = await Promise.all([
          canManage ? recruitmentService.adminOpportunities() : Promise.resolve([]),
          canReview ? recruitmentService.adminApplications() : Promise.resolve([]),
        ]);
        if (active) { setOpenings(nextOpenings); setApplications(nextApplications); }
      } catch (loadError) {
        if (active) setError(getApiErrorMessage(loadError, 'Recruitment could not be loaded.'));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [canManage, canReview, reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (actionError) {
      Alert.alert('Recruitment', getApiErrorMessage(actionError, 'The action could not be completed.'));
    } finally {
      setBusy(false);
    }
  };

  const create = () => {
    if (title.trim().length < 2 || description.trim().length < 20 || role.trim().length < 2 || category.trim().length < 2) {
      Alert.alert('Opening', 'Enter a title, role and category, and a description of at least 20 characters.');
      return;
    }
    void run(async () => {
      await recruitmentService.createOpportunity({ type, workMode, title: title.trim(), description: description.trim(), role: role.trim(), category: category.trim(), location: location.trim() || undefined, salary: salary.trim() || undefined });
      setTitle(''); setDescription(''); setRole(''); setCategory(''); setLocation(''); setSalary('');
      setTab('openings');
    });
  };

  const tabs = [
    ...(canManage ? [{ value: 'openings', label: 'OPENINGS' }, { value: 'create', label: 'NEW OPENING' }] : []),
    ...(canReview ? [{ value: 'applications', label: 'APPLICATIONS' }] : []),
  ];

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="People" title="Recruitment" />
      <TabBar value={tab} options={tabs} onChange={setTab} />
      {loading ? <Loader /> : error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : (
        <>
          {tab === 'openings' ? openings.length ? openings.map((opening) => (
            <DataCard key={opening._id} title={opening.title} subtitle={`${opening.type} - ${opening.workMode}`} badge={opening.status} actions={(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const).map((status) => <ActionChip key={status} disabled={busy || opening.status === status} label={status} onPress={() => void run(() => recruitmentService.setOpportunityStatus(opening._id, status))} />)}>
              <Text className="font-sans text-sm text-muted">{opening.description}</Text>
            </DataCard>
          )) : <EmptyHint title="No openings yet" /> : null}
          {tab === 'create' ? (
            <View className="gap-3">
              <TabBar value={type} options={[{ value: 'JOB', label: 'JOB' }, { value: 'INTERNSHIP', label: 'INTERNSHIP' }]} onChange={(value) => setType(value as typeof type)} />
              <Field placeholder="Title" value={title} onChangeText={setTitle} />
              <Field placeholder="Description" value={description} onChangeText={setDescription} multiline />
              <Field placeholder="Role" value={role} onChangeText={setRole} />
              <Field placeholder="Category" value={category} onChangeText={setCategory} />
              <TabBar value={workMode} options={['REMOTE', 'ONSITE', 'HYBRID'].map((value) => ({ value, label: value }))} onChange={(value) => setWorkMode(value as typeof workMode)} />
              <Field placeholder="Location" value={location} onChangeText={setLocation} />
              <Field placeholder="Salary or stipend" value={salary} onChangeText={setSalary} />
              <PrimaryButton label="Create draft" icon="add" busy={busy} onPress={create} />
            </View>
          ) : null}
          {tab === 'applications' ? applications.length ? applications.map((application) => (
            <DataCard key={application._id} title={application.applicantId?.name ?? application.opportunityId?.title ?? 'Application'} subtitle={application.applicantId?.email} badge={application.status}>
              <Text className="font-sans text-sm text-muted">{application.opportunityId?.title}</Text>
              <Field placeholder="Review reason" value={reasons[application._id] ?? ''} onChangeText={(value) => setReasons((current) => ({ ...current, [application._id]: value }))} />
              <View className="flex-row flex-wrap gap-2">
                <ActionChip label="Accept" tone="primary" disabled={busy || application.status === 'ACCEPTED'} onPress={() => void run(() => recruitmentService.reviewApplication(application._id, 'accept'))} />
                <ActionChip label="Decline" tone="danger" disabled={busy || application.status === 'DECLINED'} onPress={() => void run(() => recruitmentService.reviewApplication(application._id, 'decline', reasons[application._id]))} />
                {canManage && application.status === 'ACCEPTED' ? <ActionChip label="Generate offer" disabled={busy} onPress={() => void run(() => recruitmentService.offerApplication(application._id, reasons[application._id]))} /> : null}
              </View>
            </DataCard>
          )) : <EmptyHint title="No applications yet" /> : null}
        </>
      )}
    </ScrollView>
  );
}