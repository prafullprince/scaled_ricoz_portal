import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { PageHeader, Surface, cn } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type AttendancePayload = { attendance?: { today?: { checkIn?: string | null; checkOut?: string | null; totalHours?: number; status?: string } | null; summary?: { present?: number; late?: number; leave?: number; averageMinutes?: number } } };

export function AttendanceView() {
  const [payload, setPayload] = useState<AttendancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const load = async () => { try { setPayload(await workspaceService.attendance() as AttendancePayload); } catch (error) { Alert.alert('Attendance', getApiErrorMessage(error, 'Unable to load attendance.')); } finally { setLoading(false); } };
  useEffect(() => { void Promise.resolve().then(load); }, []);
  const record = async (action: 'in' | 'out') => { setActing(true); try { if (action === 'in') await workspaceService.checkIn(); else await workspaceService.checkOut(); await load(); } catch (error) { Alert.alert('Attendance', getApiErrorMessage(error, `Unable to check ${action}.`)); } finally { setActing(false); } };
  const today = payload?.attendance?.today;
  const summary = payload?.attendance?.summary;
  const metrics = [['Present', summary?.present ?? 0], ['Late', summary?.late ?? 0], ['Leave', summary?.leave ?? 0]] as const;

  return (
    <ScrollView contentContainerClassName="gap-4 px-5 pb-12 pt-5 web:mx-auto web:w-full web:max-w-2xl">
      <PageHeader eyebrow="Workday" title="Attendance" description="Record your day and keep an eye on this month’s rhythm." />
      {loading ? <ActivityIndicator className="mt-10" color={colors.brand} /> : <>
        <View className="overflow-hidden rounded-card bg-ink p-5">
          <View className="absolute bottom-0 left-0 h-1 w-28 bg-green-400" />
          <View className="flex-row items-center justify-between"><Text className="font-extra text-[10px] uppercase text-gray-400">Today</Text><Ionicons color="#62D48E" name="pulse-outline" size={20} /></View>
          <Text className="mt-4 font-extra text-[27px] text-white">{today?.status?.replaceAll('_', ' ') ?? 'NOT STARTED'}</Text>
          <Text className="mt-1 font-medium text-sm text-gray-400">{today?.totalHours ?? 0} hours recorded</Text>
          <View className="mt-5 flex-row gap-3"><Text className="font-medium text-xs text-gray-300">In  {today?.checkIn ? new Date(today.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</Text><Text className="text-gray-600">/</Text><Text className="font-medium text-xs text-gray-300">Out  {today?.checkOut ? new Date(today.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</Text></View>
        </View>
        <View className="flex-row gap-3">
          <Pressable className={cn('h-14 flex-1 flex-row items-center justify-center gap-2 rounded-card bg-success active:opacity-80', (acting || Boolean(today?.checkIn)) && 'opacity-35')} disabled={acting || Boolean(today?.checkIn)} onPress={() => record('in')}><Ionicons color={colors.white} name="log-in-outline" size={19} /><Text className="font-bold text-sm text-white">Check in</Text></Pressable>
          <Pressable className={cn('h-14 flex-1 flex-row items-center justify-center gap-2 rounded-card bg-coral active:opacity-80', (acting || !today?.checkIn || Boolean(today?.checkOut)) && 'opacity-35')} disabled={acting || !today?.checkIn || Boolean(today?.checkOut)} onPress={() => record('out')}><Ionicons color={colors.white} name="log-out-outline" size={19} /><Text className="font-bold text-sm text-white">Check out</Text></Pressable>
        </View>
        <Text className="mt-2 font-bold text-base text-ink">This month</Text>
        <View className="flex-row gap-3">{metrics.map(([label, value]) => <Surface key={label} className="min-h-24 flex-1 justify-between"><Text className="font-extra text-2xl text-ink">{value}</Text><Text className="font-medium text-[11px] text-muted">{label}</Text></Surface>)}</View>
      </>}
    </ScrollView>
  );
}
