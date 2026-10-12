import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '@/constants/theme';
import { chatPalette, type ChatTheme } from '@/providers/chat-theme';

export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export function BrandSignature({ compact = false }: { compact?: boolean }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className={cn('skew-x-[-18deg] bg-coral', compact ? 'h-2 w-8' : 'h-2.5 w-11')} />
      <Text className={cn('font-extra text-ink', compact ? 'text-base' : 'text-xl')}>RICOZ</Text>
    </View>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <View className="gap-2 pb-2">
      <View className="flex-row items-center justify-between gap-4">
        <Text className="min-w-0 flex-1 font-extra text-[11px] leading-4 uppercase text-coral">{eyebrow}</Text>
        {action}
      </View>
      <Text className="font-bold text-[24px] leading-8 text-ink">{title}</Text>
      {description ? <Text className="max-w-xl font-sans text-[14px] leading-5 text-muted">{description}</Text> : null}
    </View>
  );
}

export function SectionLabel({ children, action }: PropsWithChildren<{ action?: ReactNode }>) {
  return (
    <View className="mt-3 flex-row items-center justify-between gap-3">
      <Text className="min-w-0 flex-1 font-bold text-base leading-6 text-ink">{children}</Text>
      {action}
    </View>
  );
}

export function Surface({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <View className={cn('rounded-card border border-line bg-white p-4', className)}>{children}</View>;
}

export function Field({ icon, className, theme, ...props }: TextInputProps & { icon?: ComponentProps<typeof Ionicons>['name']; className?: string; theme?: ChatTheme }) {
  const palette = theme ? chatPalette[theme] : undefined;
  return (
    <View className={cn('min-h-12 flex-row items-center gap-3 rounded-card border border-line bg-white px-4', props.multiline && 'items-start py-3', className)} style={palette ? { backgroundColor: palette.input, borderColor: palette.line } : undefined}>
      {icon ? <Ionicons color={palette?.secondary ?? colors.muted} name={icon} size={19} /> : null}
      <TextInput
        {...props}
        className="min-h-12 min-w-0 flex-1 font-medium text-[15px] text-ink"
        style={[props.style, props.multiline && { minHeight: 112, textAlignVertical: 'top' }, palette ? { color: palette.text } : undefined]}
        placeholderTextColor={palette?.secondary ?? colors.muted}
      />
    </View>
  );
}

export function PrimaryButton({ label, icon, busy, disabled, onPress, tone = 'coral', theme }: { label: string; icon?: ComponentProps<typeof Ionicons>['name']; busy?: boolean; disabled?: boolean; onPress: () => void; tone?: 'coral' | 'ink' | 'teal'; theme?: ChatTheme }) {
  const background = tone === 'ink' ? 'bg-ink' : tone === 'teal' ? 'bg-teal' : 'bg-coral';
  const themedBackground = theme && tone === 'coral' ? chatPalette[theme].accent : undefined;
  return (
    <Pressable accessibilityRole="button" className={cn('min-h-12 flex-row items-center justify-center gap-2 rounded-card px-4 py-3 active:opacity-80', background, (busy || disabled) && 'opacity-50')} style={themedBackground ? { backgroundColor: themedBackground } : undefined} disabled={busy || disabled} onPress={onPress}>
      {busy ? <ActivityIndicator color={colors.white} /> : <><Text className="shrink text-center font-bold text-[15px] leading-5 text-white">{label}</Text>{icon ? <Ionicons color={colors.white} name={icon} size={19} /> : null}</>}
    </Pressable>
  );
}

export function IconButton({ label, icon, onPress, danger = false }: { label: string; icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} className={cn('h-11 w-11 shrink-0 items-center justify-center rounded-card border bg-white active:opacity-70', danger ? 'border-red-200' : 'border-line')} onPress={onPress}>
      <Ionicons color={danger ? colors.danger : colors.ink} name={icon} size={20} />
    </Pressable>
  );
}

export function EmptyState({ icon, title, description }: { icon: ComponentProps<typeof Ionicons>['name']; title: string; description: string }) {
  return (
    <View className="items-center gap-2 py-12">
      <View className="mb-2 h-12 w-12 items-center justify-center rounded-card bg-mint"><Ionicons color={colors.teal} name={icon} size={23} /></View>
      <Text className="font-bold text-base text-ink">{title}</Text>
      <Text className="max-w-64 text-center font-sans text-sm leading-5 text-muted">{description}</Text>
    </View>
  );
}
