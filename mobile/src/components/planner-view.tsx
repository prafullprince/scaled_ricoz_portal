import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { FormScrollView as ScrollView } from '@/components/ui/form-scroll-view';

import { EmptyState, PageHeader, PrimaryButton } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type PlannerBlock = { title?: string; detail?: string; start?: string; end?: string; priority?: string };
type PlannerPayload = { plan?: { summary?: string; blocks?: PlannerBlock[]; recommendations?: string[] } };

export function PlannerView() {
  const [description, setDescription] = useState('');
  const [plan, setPlan] = useState<PlannerPayload['plan'] | null>(null);
  const [loading, setLoading] = useState(false);
  const generate = async () => { if (description.trim().length < 10) { Alert.alert('Planner', 'Describe your work in a little more detail.'); return; } setLoading(true); try { const payload = await workspaceService.generatePlan(description.trim()) as PlannerPayload; setPlan(payload.plan); } catch (error) { Alert.alert('Planner', getApiErrorMessage(error, 'Unable to generate a plan.')); } finally { setLoading(false); } };

  return (
    <ScrollView contentContainerClassName="gap-4 px-5 pb-12 pt-5 web:mx-auto web:w-full web:max-w-2xl" keyboardShouldPersistTaps="handled">
      <PageHeader eyebrow="Focus map" title="Plan the day" description="Turn a rough list of priorities into focused, time-boxed work." />
      <View className="gap-3">
        <TextInput className="min-h-36 rounded-card border border-line bg-white px-4 py-4 font-medium text-[15px] leading-6 text-ink" multiline onChangeText={setDescription} placeholder="Describe what needs to get done today..." placeholderTextColor={colors.muted} textAlignVertical="top" value={description} />
        <PrimaryButton busy={loading} icon="sparkles-outline" label="Generate plan" onPress={generate} tone="teal" />
      </View>
      {plan?.summary ? <View className="mt-3 border-l-4 border-coral bg-white px-4 py-3"><Text className="font-semibold text-[15px] leading-6 text-ink">{plan.summary}</Text></View> : null}
      {plan?.blocks?.map((block, index) => <View key={`${block.title}-${index}`} className="flex-row gap-4 rounded-card border border-line bg-white p-4"><View className="w-14 items-center"><View className="h-8 w-8 items-center justify-center rounded-card bg-mint"><Ionicons color={colors.teal} name="time-outline" size={17} /></View><Text className="mt-2 font-extra text-[10px] text-coral">{block.start ?? '--:--'}</Text><View className="my-1 h-3 w-px bg-line" /><Text className="font-extra text-[10px] text-coral">{block.end ?? '--:--'}</Text></View><View className="flex-1 gap-1"><Text className="font-bold text-[15px] text-ink">{block.title ?? 'Focus block'}</Text><Text className="font-sans text-[13px] leading-5 text-muted">{block.detail}</Text></View></View>)}
      {!plan && !loading ? <EmptyState description="Your generated focus blocks will appear here." icon="map-outline" title="A clear day starts here" /> : null}
    </ScrollView>
  );
}
