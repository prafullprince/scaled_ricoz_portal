import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { cn } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { chatPalette, type ChatTheme } from '@/providers/chat-theme';

export type TabOption = { value: string; label: string };

export function TabBar({ value, options, onChange }: { value: string; options: TabOption[]; onChange: (value: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full rounded-card border border-line bg-white" style={{ flexGrow: 0 }} contentContainerClassName="gap-1.5 p-1.5">
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === option.value }}
          className={cn('min-h-11 min-w-24 items-center justify-center rounded-[6px] px-3 py-2.5 active:opacity-75', value === option.value ? 'bg-ink' : 'bg-transparent')}
          onPress={() => onChange(option.value)}
        >
          <Text className={cn('font-bold text-[11px]', value === option.value ? 'text-white' : 'text-muted')}>{option.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function Loader({ color, theme }: { color?: string; theme?: ChatTheme }) {
  return <ActivityIndicator color={color ?? (theme ? chatPalette[theme].accent : colors.brand)} size="large" style={{ marginVertical: 32 }} />;
}

export function ErrorBanner({ message, onRetry, theme }: { message: string; onRetry?: () => void; theme?: ChatTheme }) {
  const dark = theme === 'dark';
  return (
    <View className="border-l-4 border-danger bg-red-50 p-4" style={theme ? { backgroundColor: dark ? '#3a1d1b' : '#fef3f2', borderColor: '#b42318' } : undefined}>
      <Text className="font-sans text-[13px] leading-5 text-danger" style={theme ? { color: dark ? '#fda29b' : '#b42318' } : undefined}>{message}</Text>
      {onRetry ? (
        <Pressable className="mt-2 self-start active:opacity-70" onPress={onRetry}>
          <Text className="font-bold text-[13px] text-danger" style={theme ? { color: dark ? '#fda29b' : '#b42318' } : undefined}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyHint({ icon = 'file-tray-outline', title, description, theme }: { icon?: ComponentProps<typeof Ionicons>['name']; title: string; description?: string; theme?: ChatTheme }) {
  const palette = theme ? chatPalette[theme] : undefined;
  return (
    <View className="items-center gap-1.5 rounded-card border border-line bg-white px-6 py-10" style={palette ? { backgroundColor: palette.panel, borderColor: palette.line } : undefined}>
      <View className="mb-1 h-11 w-11 items-center justify-center rounded-card bg-mint" style={palette ? { backgroundColor: theme === 'light' ? '#eaf8ef' : '#12382c' } : undefined}>
        <Ionicons color={palette?.accent ?? colors.teal} name={icon} size={21} />
      </View>
      <Text className="text-center font-bold text-[15px] leading-5 text-ink" style={palette ? { color: palette.text } : undefined}>{title}</Text>
      {description ? <Text className="max-w-72 text-center font-sans text-[13px] leading-5 text-muted" style={palette ? { color: palette.secondary } : undefined}>{description}</Text> : null}
    </View>
  );
}

export function DataCard({ title, subtitle, badge, children, actions, theme }: { title: string; subtitle?: string; badge?: string; children?: ReactNode; actions?: ReactNode; theme?: ChatTheme }) {
  const palette = theme ? chatPalette[theme] : undefined;
  return (
    <View className="gap-2 rounded-card border border-line bg-white p-4" style={palette ? { backgroundColor: palette.panel, borderColor: palette.line } : undefined}>
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-bold text-[15px] leading-5 text-ink" style={palette ? { color: palette.text } : undefined}>{title}</Text>
          {subtitle ? <Text className="font-sans text-xs leading-4 text-muted" style={palette ? { color: palette.secondary } : undefined}>{subtitle}</Text> : null}
        </View>
        {badge ? <View className="max-w-[45%] shrink rounded bg-paper px-2 py-1" style={palette ? { backgroundColor: palette.raised } : undefined}><Text className="font-extra text-[10px] leading-4 uppercase text-teal" style={palette ? { color: palette.accent } : undefined}>{badge}</Text></View> : null}
      </View>
      {children}
      {actions ? <View className="flex-row flex-wrap gap-2 pt-1">{actions}</View> : null}
    </View>
  );
}


export function ActionChip({ label, onPress, tone = 'muted', disabled, theme }: { label: string; onPress: () => void; tone?: 'primary' | 'danger' | 'muted'; disabled?: boolean; theme?: ChatTheme }) {
  const palette = theme ? chatPalette[theme] : undefined;
  const toneClass = tone === 'primary' ? 'border-ink bg-ink' : tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-line bg-paper';
  const textClass = tone === 'primary' ? 'text-white' : tone === 'danger' ? 'text-danger' : 'text-ink';
  const chipStyle = palette ? {
    backgroundColor: tone === 'primary' ? palette.accent : tone === 'danger' ? (theme === 'dark' ? '#3a1d1b' : '#fef3f2') : palette.raised,
    borderColor: tone === 'danger' ? (theme === 'dark' ? '#5b2925' : '#fecdca') : palette.line,
  } : undefined;
  const labelStyle = palette ? { color: tone === 'primary' ? (theme === 'dark' ? '#082a16' : '#ffffff') : tone === 'danger' ? (theme === 'dark' ? '#fda29b' : '#b42318') : palette.text } : undefined;
  return (
    <Pressable accessibilityRole="button" className={cn('min-h-11 max-w-full items-center justify-center rounded-card border px-3.5 py-2 active:opacity-70', toneClass, disabled && 'opacity-50')} style={chipStyle} disabled={disabled} onPress={onPress}>
      <Text className={cn('shrink text-center font-bold text-[12px] leading-4', textClass)} style={labelStyle}>{label}</Text>
    </Pressable>
  );
}

export function StatGrid({ items }: { items: { label: string; value: string | number }[] }) {
  const [width, setWidth] = useState(0);
  const columns = width >= 560 ? 3 : 2;
  if (!items.length) return null;
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} className="flex-row flex-wrap gap-2">
      {items.map((item, index) => (
        <View key={`${item.label}-${index}`} style={{ width: width ? (width - 8 * (columns - 1)) / columns : '48%' }} className="min-h-[84px] gap-1 rounded-card border border-line bg-white p-3">
          <Text className="font-medium text-[10px] leading-4 uppercase text-muted">{item.label}</Text>
          <Text className="font-extra text-lg leading-6 text-ink">{String(item.value)}</Text>
        </View>
      ))}
    </View>
  );
}

const pickTitle = (record: Record<string, unknown>, index: number) => {
  for (const key of ['title', 'name', 'user_name', 'label', 'summary', 'message', 'type', 'status']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (typeof nested.name === 'string' && nested.name.trim()) return nested.name;
      if (typeof nested.title === 'string' && nested.title.trim()) return nested.title;
    }
  }
  return `Record ${index + 1}`;
};

export const recordTitle = pickTitle;

export const recordSummary = (record: Record<string, unknown>, skip = 4) =>
  Object.entries(record)
    .filter(([key, value]) => ['string', 'number', 'boolean'].includes(typeof value) && !['_id', 'id', '__v'].includes(key))
    .slice(0, skip)
    .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${String(value)}`)
    .join('\n');

export const extractRecords = (data: unknown): Record<string, unknown>[] => {
  if (Array.isArray(data)) return data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object');
  if (!data || typeof data !== 'object') return [];
  const object = data as Record<string, unknown>;
  for (const value of Object.values(object)) {
    if (Array.isArray(value)) return extractRecords(value);
  }
  return [object];
};

export const findArrayByKey = (data: unknown, keys: string[]): unknown[] => {
  if (!data || typeof data !== 'object') return [];
  const object = data as Record<string, unknown>;
  for (const key of keys) {
    const value = object[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = findArrayByKey(value, keys);
      if (nested.length) return nested;
    }
  }
  return [];
};

export const toId = (record: Record<string, unknown>, index: number) => String(record._id ?? record.id ?? index);
