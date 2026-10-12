import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader, SectionLabel } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar, extractRecords, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { serviceAdminService } from '@/services/serviceAdmin.service';
import { workspaceService } from '@/services/workspace.service';

const TABS = [
  { value: 'overview', label: 'OVERVIEW' },
  { value: 'projects', label: 'PROJECTS' },
  { value: 'requests', label: 'REQUESTS' },
  { value: 'orders', label: 'ORDERS' },
  { value: 'billing', label: 'BILLING' },
];

export function CustomerPortalView() {
  const [tab, setTab] = useState('overview');
  const [forbidden, setForbidden] = useState(false);
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [requests, setRequests] = useState<Record<string, unknown>[]>([]);
  const [services, setServices] = useState<Record<string, unknown>[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [timeline, setTimeline] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); setForbidden(false); } });
    (async () => {
      try {
        await workspaceService.gate('customer');
      } catch (gateError) {
        const status = (gateError as { response?: { status?: number } }).response?.status;
        if (status === 403) {
          if (active) setForbidden(true);
          return;
        }
        throw gateError;
      }
      const [nextRequests, nextProjects, nextServices] = await Promise.all([
        serviceAdminService.customerRequests().catch(() => []),
        serviceAdminService.customerProjects().catch(() => []),
        serviceAdminService.publicServices().catch(() => []),
      ]);
      if (!active) return;
      setRequests(extractRecords(nextRequests));
      setProjects(extractRecords(nextProjects));
      setServices(extractRecords(nextServices));
    })()
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Your customer portal could not be loaded.')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const submitRequest = () => {
    if (!serviceId || projectTitle.trim().length < 3 || projectDescription.trim().length < 20) {
      Alert.alert('Service request', 'Choose a service, add a project title and describe the project in at least 20 characters.');
      return;
    }
    setBusy(true);
    serviceAdminService
      .createRequest(serviceId, {
        projectTitle: projectTitle.trim(),
        projectDescription: projectDescription.trim(),
        expectedTimeline: timeline.trim() || undefined,
      })
      .then(() => {
        setProjectTitle('');
        setProjectDescription('');
        setTimeline('');
        setReloadKey((value) => value + 1);
        setTab('requests');
      })
      .catch((loadError) => Alert.alert('Service request', getApiErrorMessage(loadError, 'Unable to submit the request.')))
      .finally(() => setBusy(false));
  };

  const listSection = (rows: Record<string, unknown>[], emptyTitle: string, emptyDescription: string) =>
    rows.length ? (
      <View className="gap-2.5">
        {rows.map((row, index) => (
          <DataCard key={toId(row, index)} badge={typeof row.status === 'string' ? row.status : undefined} title={recordTitle(row, index)}>
            <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(row, 5)}</Text>
          </DataCard>
        ))}
      </View>
    ) : (
      <EmptyHint description={emptyDescription} icon="folder-outline" title={emptyTitle} />
    );

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Customer" title="Customer portal" description="Your projects, service requests, orders and billing." />
      <TabBar onChange={setTab} options={TABS} value={tab} />
      {loading ? <Loader color={colors.teal} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {forbidden && !loading ? (
        <View className="gap-2 rounded-card border border-line bg-white p-5">
          <Text className="font-bold text-[15px] text-ink">Your account does not have access to this area yet.</Text>
          <Text className="font-sans text-[13px] leading-5 text-muted">Customer access is granted by the Ricoz team once your account is onboarded.</Text>
        </View>
      ) : null}
      {!loading && !error && !forbidden ? (
        <>
          {tab === 'overview' ? (
            <>
              <StatGrid items={[
                { label: 'Projects', value: projects.length },
                { label: 'Requests', value: requests.length },
                { label: 'Services', value: services.length },
              ]} />
              {listSection(requests.slice(0, 3), 'No requests yet', 'Start a service request from the Requests tab.')}
            </>
          ) : null}
          {tab === 'projects' ? listSection(projects, 'No projects yet', 'Active projects delivered by Ricoz will appear here.') : null}
          {tab === 'requests' ? (
            <View className="gap-3">
              {listSection(requests, 'No requests yet', 'Submitted service requests and their status will appear here.')}
              <SectionLabel>New service request</SectionLabel>
              <View className="gap-2 rounded-card border border-line bg-white p-4">
                {services.length ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {services.slice(0, 12).map((service, index) => {
                      const id = String(service._id ?? service.id ?? index);
                      const title = String(service.title ?? `Service ${index + 1}`);
                      return (
                        <ActionChip key={id} label={title} onPress={() => setServiceId(id)} tone={serviceId === id ? 'primary' : 'muted'} />
                      );
                    })}
                  </View>
                ) : (
                  <Text className="font-sans text-[13px] text-muted">Service id: paste the service id you want to request.</Text>
                )}
                <TextInput className="min-h-11 rounded-card border border-line bg-paper px-3 font-medium text-[14px] text-ink" onChangeText={setServiceId} placeholder="Service id" placeholderTextColor={colors.muted} value={serviceId} />
                <TextInput className="min-h-11 rounded-card border border-line bg-paper px-3 font-medium text-[14px] text-ink" onChangeText={setProjectTitle} placeholder="Project title" placeholderTextColor={colors.muted} value={projectTitle} />
                <TextInput className="min-h-24 rounded-card border border-line bg-paper px-3 py-2 font-medium text-[14px] text-ink" multiline onChangeText={setProjectDescription} placeholder="Project description (20+ characters)" placeholderTextColor={colors.muted} textAlignVertical="top" value={projectDescription} />
                <TextInput className="min-h-11 rounded-card border border-line bg-paper px-3 font-medium text-[14px] text-ink" onChangeText={setTimeline} placeholder="Expected timeline (optional)" placeholderTextColor={colors.muted} value={timeline} />
                <ActionChip disabled={busy} label={busy ? 'Submitting…' : 'Submit request'} onPress={submitRequest} tone="primary" />
              </View>
            </View>
          ) : null}
          {tab === 'orders' ? <EmptyHint description="Your order history with Ricoz will appear here once orders are placed." icon="cart-outline" title="No orders yet" /> : null}
          {tab === 'billing' ? <EmptyHint description="Invoices and billing history will appear here." icon="receipt-outline" title="No billing yet" /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}
