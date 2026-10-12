import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { PageHeader, SectionLabel } from '@/components/ui/primitives';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader, StatGrid, TabBar, extractRecords, findArrayByKey, recordSummary, recordTitle, toId } from '@/components/ui/view-kit';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { marketingService, type MarketingChannel, type MarketingPriority } from '@/services/marketing.service';

const TABS = [
  { value: 'dashboard', label: 'DASHBOARD' },
  { value: 'campaigns', label: 'CAMPAIGNS' },
  { value: 'tasks', label: 'MY WORK' },
];

const CHANNELS: MarketingChannel[] = ['GOOGLE', 'META', 'EMAIL', 'WHATSAPP', 'LINKEDIN', 'ORGANIC', 'OTHER'];
const PRIORITIES: MarketingPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const statsOf = (dashboard: unknown): { label: string; value: string | number }[] => {
  if (!dashboard || typeof dashboard !== 'object') return [];
  const stats = (dashboard as Record<string, unknown>).stats ?? (dashboard as Record<string, unknown>);
  if (!stats || typeof stats !== 'object') return [];
  return Object.entries(stats as Record<string, unknown>)
    .filter(([, value]) => ['string', 'number'].includes(typeof value))
    .slice(0, 6)
    .map(([key, value]) => ({ label: key.replaceAll('_', ' '), value: value as string | number }));
};

export function MarketingWorkspaceView() {
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [campaignName, setCampaignName] = useState('');
  const [campaignObjective, setCampaignObjective] = useState('');
  const [campaignBudget, setCampaignBudget] = useState('0');
  const [campaignStart, setCampaignStart] = useState('');
  const [campaignEnd, setCampaignEnd] = useState('');
  const [campaignChannels, setCampaignChannels] = useState<MarketingChannel[]>(['EMAIL']);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskPriority, setTaskPriority] = useState<MarketingPriority>('MEDIUM');
  const [taskAssignees, setTaskAssignees] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoading(true); setError(''); } });
    marketingService
      .dashboard()
      .then((payload) => active && setDashboard(payload))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'The marketing dashboard could not be loaded.')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setReloadKey((value) => value + 1);
    } catch (loadError) {
      Alert.alert('Marketing', getApiErrorMessage(loadError, 'This action failed.'));
    } finally {
      setBusy(false);
    }
  };


  const toggleChannel = (channel: MarketingChannel) =>
    setCampaignChannels((current) => (current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]));

  const submitCampaign = () => {
    if (campaignName.trim().length < 2 || campaignObjective.trim().length < 2 || !campaignChannels.length) {
      Alert.alert('Campaign', 'Add a name, objective and at least one channel.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(campaignStart) || !/^\d{4}-\d{2}-\d{2}$/.test(campaignEnd)) {
      Alert.alert('Campaign', 'Use YYYY-MM-DD dates.');
      return;
    }
    void run(async () => {
      await marketingService.createCampaign({
        name: campaignName.trim(),
        objective: campaignObjective.trim(),
        channels: campaignChannels,
        budget: Number(campaignBudget) || 0,
        startDate: campaignStart,
        endDate: campaignEnd,
      });
      setCampaignName('');
      setCampaignObjective('');
      setCampaignBudget('0');
      setCampaignStart('');
      setCampaignEnd('');
    });
  };

  const submitTask = () => {
    const assignedToIds = taskAssignees.split(',').map((id) => id.trim()).filter(Boolean);
    if (taskTitle.trim().length < 2 || taskDescription.trim().length < 2 || !assignedToIds.length) {
      Alert.alert('Marketing task', 'Add a title, description and at least one assignee id.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(taskDeadline)) {
      Alert.alert('Marketing task', 'Use a deadline in YYYY-MM-DD format.');
      return;
    }
    void run(async () => {
      await marketingService.createTask({ title: taskTitle.trim(), description: taskDescription.trim(), assignedToIds, priority: taskPriority, deadline: taskDeadline });
      setTaskTitle('');
      setTaskDescription('');
      setTaskDeadline('');
      setTaskAssignees('');
    });
  };

  const campaigns = findArrayByKey(dashboard, ['campaigns']);
  const tasks = findArrayByKey(dashboard, ['tasks']);

  return (
    <ScrollView className="bg-canvas" contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Department" title="Marketing workspace" description="Dashboard, campaigns and campaign work items." />
      <TabBar onChange={setTab} options={TABS} value={tab} />
      {loading ? <Loader color={colors.teal} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error ? (
        <>
          {tab === 'dashboard' ? (
            <>
              <StatGrid items={statsOf(dashboard)} />
              <View className="gap-2.5">
                {extractRecords(dashboard).slice(0, 10).map((record, index) => (
                  <DataCard key={toId(record, index)} badge={typeof record.status === 'string' ? record.status : undefined} title={recordTitle(record, index)}>
                    <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 4)}</Text>
                  </DataCard>
                ))}
              </View>
            </>
          ) : null}
          {tab === 'campaigns' ? (
            <View className="gap-3">
              <SectionLabel>New campaign</SectionLabel>
              <TextInput className="min-h-11 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink" onChangeText={setCampaignName} placeholder="Campaign name" placeholderTextColor={colors.muted} value={campaignName} />
              <TextInput className="min-h-11 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink" onChangeText={setCampaignObjective} placeholder="Objective" placeholderTextColor={colors.muted} value={campaignObjective} />
              <View className="flex-row flex-wrap gap-1.5">
                {CHANNELS.map((channel) => (
                  <Pressable key={channel} className={`rounded-card border px-2.5 py-1.5 ${campaignChannels.includes(channel) ? 'border-ink bg-ink' : 'border-line bg-paper'}`} onPress={() => toggleChannel(channel)}>
                    <Text className={`font-bold text-[11px] ${campaignChannels.includes(channel) ? 'text-white' : 'text-ink'}`}>{channel}</Text>
                  </Pressable>
                ))}
              </View>
              <View className="gap-3">
                <TextInput accessibilityLabel="Campaign budget" className="min-h-12 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink" keyboardType="numeric" onChangeText={setCampaignBudget} placeholder="Budget" placeholderTextColor={colors.muted} value={campaignBudget} />
                <TextInput accessibilityLabel="Campaign start date" className="min-h-12 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink" onChangeText={setCampaignStart} placeholder="Start YYYY-MM-DD" placeholderTextColor={colors.muted} value={campaignStart} />
                <TextInput accessibilityLabel="Campaign end date" className="min-h-12 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink" onChangeText={setCampaignEnd} placeholder="End YYYY-MM-DD" placeholderTextColor={colors.muted} value={campaignEnd} />
              </View>
              <ActionChip disabled={busy} label="Create campaign" onPress={submitCampaign} tone="primary" />
              <SectionLabel>Campaigns</SectionLabel>
              {campaigns.length ? (
                <View className="gap-2.5">
                  {campaigns.map((item, index) => {
                    const record = (typeof item === 'object' && item ? item : {}) as Record<string, unknown>;
                    const campaignId = toId(record, index);
                    return (
                      <DataCard key={campaignId} badge={typeof record.status === 'string' ? record.status : undefined} title={recordTitle(record, index)}>
                        <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 4)}</Text>
                        <View className="flex-row flex-wrap gap-2 pt-1">
                          <ActionChip disabled={busy} label="Submit" onPress={() => void run(() => marketingService.submitCampaign(campaignId))} tone="primary" />
                          <ActionChip disabled={busy} label="Approve" onPress={() => void run(() => marketingService.reviewCampaign(campaignId, 'APPROVE'))} />
                        </View>
                      </DataCard>
                    );
                  })}
                </View>
              ) : (
                <EmptyHint description="Campaigns you create will appear here." icon="megaphone-outline" title="No campaigns yet" />
              )}
            </View>
          ) : null}

          {tab === 'tasks' ? (
            <View className="gap-3">
              <SectionLabel>New campaign task</SectionLabel>
              <TextInput className="min-h-11 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink" onChangeText={setTaskTitle} placeholder="Title" placeholderTextColor={colors.muted} value={taskTitle} />
              <TextInput className="min-h-20 rounded-card border border-line bg-white px-3 py-2 font-medium text-[14px] text-ink" multiline onChangeText={setTaskDescription} placeholder="Description" placeholderTextColor={colors.muted} textAlignVertical="top" value={taskDescription} />
              <TextInput className="min-h-11 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink" onChangeText={setTaskAssignees} placeholder="Assignee ids (comma separated)" placeholderTextColor={colors.muted} value={taskAssignees} />
              <TextInput className="min-h-11 rounded-card border border-line bg-white px-3 font-medium text-[14px] text-ink" onChangeText={setTaskDeadline} placeholder="Deadline YYYY-MM-DD" placeholderTextColor={colors.muted} value={taskDeadline} />
              <View className="flex-row flex-wrap gap-1.5">
                {PRIORITIES.map((priority) => (
                  <Pressable key={priority} className={`rounded-card border px-2.5 py-1.5 ${taskPriority === priority ? 'border-ink bg-ink' : 'border-line bg-paper'}`} onPress={() => setTaskPriority(priority)}>
                    <Text className={`font-bold text-[11px] ${taskPriority === priority ? 'text-white' : 'text-ink'}`}>{priority}</Text>
                  </Pressable>
                ))}
              </View>
              <ActionChip disabled={busy} label="Create task" onPress={submitTask} tone="primary" />
              <SectionLabel>Assigned work</SectionLabel>
              {tasks.length ? (
                <View className="gap-2.5">
                  {tasks.map((item, index) => {
                    const record = (typeof item === 'object' && item ? item : {}) as Record<string, unknown>;
                    const taskId = toId(record, index);
                    return (
                      <DataCard key={taskId} badge={typeof record.status === 'string' ? record.status : undefined} title={recordTitle(record, index)}>
                        <Text className="font-sans text-xs leading-4 text-muted">{recordSummary(record, 4)}</Text>
                        <View className="flex-row flex-wrap gap-2 pt-1">
                          <ActionChip disabled={busy} label="Mark complete" onPress={() => void run(() => marketingService.completeTask(taskId))} tone="primary" />
                        </View>
                      </DataCard>
                    );
                  })}
                </View>
              ) : (
                <EmptyHint description="Campaign tasks assigned to you will appear here." icon="list-outline" title="No tasks yet" />
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
