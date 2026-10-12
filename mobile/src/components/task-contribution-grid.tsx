import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { contributionDays, type DailyTaskReport } from '@/features/task-model';

const tones = ['#e3e5e7', '#fce8e9', '#ef7779', '#00a96f'];

export function TaskContributionGrid({ reports = [], title = 'Daily contribution' }: { reports?: DailyTaskReport[]; title?: string }) {
  const [selected, setSelected] = useState<string>();
  const [width, setWidth] = useState(0);
  const days = contributionDays(reports);
  const columns = 12;
  const cell = 14;
  const gap = 4;
  const selectedDay = days.find((day) => day.date === selected);
  const scale = (width || columns * (cell + gap)) / (columns * (cell + gap));
  return <View className="gap-3 rounded-card border border-line bg-paper p-4">
    <View className="flex-row flex-wrap items-center justify-between gap-2"><Text className="font-semibold text-sm text-ink">{title}</Text><Text className="font-sans text-xs text-muted">{reports.length} reports</Text></View>
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: 7 * (cell + gap) * scale }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${columns * (cell + gap)} ${7 * (cell + gap)}`} accessibilityLabel="Daily contribution over the last twelve weeks">{days.map((day, index) => <Rect key={day.date} x={(index % columns) * (cell + gap)} y={Math.floor(index / columns) * (cell + gap)} width={cell} height={cell} rx={2} fill={tones[day.tone]} stroke={selected === day.date ? '#242628' : 'none'} />)}</Svg>
      {days.map((day, index) => <Pressable key={day.date} accessibilityRole="button" accessibilityLabel={`${day.date}: ${day.entries.length ? `${day.progress}% progress` : 'No report'}`} onPress={() => setSelected(day.date)} style={{ position: 'absolute', left: (index % columns) * (cell + gap) * scale, top: Math.floor(index / columns) * (cell + gap) * scale, width: cell * scale, height: cell * scale }} />)}
    </View>
    <View className="flex-row flex-wrap justify-between gap-2"><Text className="font-sans text-[11px] text-muted">Last 12 weeks</Text><View className="flex-row items-center gap-1"><Text className="font-sans text-[11px] text-muted">Less</Text>{tones.map((tone) => <View key={tone} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: tone }} />)}<Text className="font-sans text-[11px] text-muted">More</Text></View></View>
    {selectedDay ? <Text className="font-sans text-xs leading-5 text-ink">{selectedDay.date}: {selectedDay.entries.length ? `${selectedDay.progress}% progress / ${selectedDay.entries.length} reports` : 'No report'}</Text> : null}
  </View>;
}