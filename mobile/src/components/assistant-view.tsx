import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { EmptyState, PageHeader, cn } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { getApiErrorMessage } from '@/services/api';
import { workspaceService } from '@/services/workspace.service';

type ChatEntry = { id: string; role: 'user' | 'assistant'; text: string };

const markdownStyles = {
  body: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  heading1: { color: colors.ink, fontSize: 20, fontWeight: '700' as const, marginTop: 10, marginBottom: 6 },
  heading2: { color: colors.ink, fontSize: 17, fontWeight: '700' as const, marginTop: 10, marginBottom: 5 },
  heading3: { color: colors.ink, fontSize: 15, fontWeight: '700' as const, marginTop: 8, marginBottom: 4 },
  paragraph: { marginTop: 4, marginBottom: 8 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  code_inline: { backgroundColor: '#e9eef4', color: colors.ink, fontFamily: 'monospace' },
  fence: { backgroundColor: '#142238', color: '#ffffff', padding: 12, borderRadius: 10 },
  link: { color: colors.brand, textDecorationLine: 'underline' as const },
};

export function AssistantView() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => { const text = message.trim(); if (!text || sending) return; const responseId = `${Date.now()}-assistant`; setMessage(''); setEntries((current) => [...current, { id: `${Date.now()}-user`, role: 'user', text }, { id: responseId, role: 'assistant', text: '' }]); setSending(true); try { await workspaceService.streamAssistantMessage(text, (delta) => setEntries((current) => current.map((entry) => entry.id === responseId ? { ...entry, text: entry.text + delta } : entry))); } catch (error) { setEntries((current) => current.map((entry) => entry.id === responseId ? { ...entry, text: getApiErrorMessage(error, 'I could not answer that request.') } : entry)); } finally { setSending(false); } };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-canvas" keyboardVerticalOffset={90}>
      <View className="px-5 pt-5"><PageHeader eyebrow="Ricoz intelligence" title="Assistant" description="Work through priorities, services, and next steps." /></View>
      <FlatList className="flex-1" contentContainerClassName="flex-grow gap-2 px-5 py-4 web:mx-auto web:w-full web:max-w-2xl" data={entries} keyExtractor={(item) => item.id} ListEmptyComponent={<EmptyState description="Ask about your work, services, or the best next action." icon="sparkles-outline" title="What can I help with?" />} renderItem={({ item }) => <View className={cn('max-w-[84%] rounded-card px-4 py-3', item.role === 'user' ? 'self-end bg-ink' : 'self-start border border-line bg-white')}>{item.role === 'user' ? <Text className="font-sans text-[14px] leading-5 text-white">{item.text}</Text> : item.text ? <Markdown style={markdownStyles}>{item.text}</Markdown> : <Text className="text-ink">...</Text>}</View>} />
      <View className="flex-row items-end gap-2 border-t border-line bg-white px-4 py-3">
        <TextInput className="max-h-28 min-h-12 flex-1 rounded-card bg-canvas px-4 py-3 font-medium text-sm text-ink" multiline onChangeText={setMessage} placeholder="Ask Ricoz..." placeholderTextColor={colors.muted} value={message} />
        <Pressable accessibilityLabel="Send message" className={cn('h-12 w-12 items-center justify-center rounded-card bg-coral', (sending || !message.trim()) && 'opacity-40')} disabled={sending || !message.trim()} onPress={send}>{sending ? <ActivityIndicator color={colors.white} size="small" /> : <Ionicons color={colors.white} name="arrow-up" size={21} />}</Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
