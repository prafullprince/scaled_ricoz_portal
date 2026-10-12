import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Field, PrimaryButton } from '@/components/ui/primitives';
import { ChatBottomTabs } from '@/components/chat-bottom-tabs';
import { ChatThemeToggle } from '@/components/chat-theme-toggle';
import { ActionChip, DataCard, EmptyHint, ErrorBanner, Loader } from '@/components/ui/view-kit';
import { chatPalette, useChatTheme } from '@/providers/chat-theme';
import { getApiErrorMessage } from '@/services/api';
import { chatService } from '@/services/chat.service';
import { useAppSelector } from '@/store/hooks';
import type { ChatCallRecord, ChatStory } from '@/types/chat';

const backgrounds = ['#254d43', '#51436b', '#755149', '#284b63', '#333333'];

export function ChatActivityView({ mode }: { mode: 'statuses' | 'calls' }) {
  const router = useRouter();
  const { theme } = useChatTheme();
  const palette = chatPalette[theme];
  const userId = useAppSelector((state) => state.auth.user?.user_id);
  const [stories, setStories] = useState<ChatStory[]>([]);
  const [calls, setCalls] = useState<ChatCallRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [text, setText] = useState('');
  const [background, setBackground] = useState(backgrounds[0]);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewers, setViewers] = useState<string[]>([]);
  const [viewerCursor, setViewerCursor] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true); setError('');
      try {
        if (mode === 'statuses') {
          const page = await chatService.stories();
          if (active) { setStories(page.stories); setCursor(page.nextCursor); }
        } else {
          const page = await chatService.callHistory();
          if (active) { setCalls(page.calls); setCursor(page.nextCursor); }
        }
      } catch (loadError) {
        if (active) setError(getApiErrorMessage(loadError, 'Chat activity could not be loaded.'));
      } finally { if (active) setLoading(false); }
    });
    return () => { active = false; };
  }, [mode, reloadKey]);

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); }
    catch (actionError) { Alert.alert('Chat', getApiErrorMessage(actionError, 'The action failed.')); }
    finally { setBusy(false); }
  };

  const more = () => void run(async () => {
    if (!cursor) return;
    if (mode === 'statuses') {
      const page = await chatService.stories(cursor);
      setStories((current) => [...current, ...page.stories.filter((story) => !current.some((item) => item._id === story._id))]);
      setCursor(page.nextCursor);
    } else {
      const page = await chatService.callHistory(cursor);
      setCalls((current) => [...current, ...page.calls.filter((call) => !current.some((item) => item._id === call._id))]);
      setCursor(page.nextCursor);
    }
  });

  const openViewers = (storyId: string, nextCursor?: string) => void run(async () => {
    const page = await chatService.storyViewers(storyId, nextCursor);
    setSelected(storyId);
    const names = page.views.map((view) => view.userId?.name ?? 'Unavailable account');
    setViewers((current) => nextCursor ? [...current, ...names] : names);
    setViewerCursor(page.nextCursor);
  });

  return (
    <View className="flex-1" style={{ backgroundColor: palette.panel }}>
    <ScrollView className="flex-1" style={{ backgroundColor: palette.history }} contentContainerClassName="gap-4 px-5 pb-10 pt-4" keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center gap-3 border-b pb-3" style={{ backgroundColor: palette.panel, borderColor: palette.line }}>
        <Pressable accessibilityLabel="Back to conversations" className="h-10 w-10 items-center justify-center rounded-full" onPress={() => router.replace('/chat')}><Ionicons color={palette.secondary} name="arrow-back" size={21} /></Pressable>
        <View className="min-w-0 flex-1"><Text className="font-extra text-[11px] uppercase" style={{ color: palette.accent }}>Chat</Text><Text className="font-bold text-xl" style={{ color: palette.text }}>{mode === 'statuses' ? 'Statuses' : 'Call history'}</Text></View>
        <ChatThemeToggle />
        <Pressable accessibilityLabel="Refresh" className="h-10 w-10 items-center justify-center rounded-full" onPress={() => setReloadKey((value) => value + 1)}><Ionicons color={palette.secondary} name="refresh" size={20} /></Pressable>
      </View>
      {mode === 'statuses' ? (
        <View className="gap-3">
          <Field theme={theme} placeholder="Status" multiline maxLength={700} value={text} onChangeText={setText} />
          <View className="flex-row gap-3">
            {backgrounds.map((color) => <Pressable key={color} accessibilityLabel={`Background ${color}`} accessibilityRole="radio" accessibilityState={{ checked: background === color }} onPress={() => setBackground(color)} style={{ backgroundColor: color, width: 36, height: 36, borderRadius: 6, borderWidth: background === color ? 3 : 0, borderColor: palette.accent }} />)}
          </View>
          <PrimaryButton theme={theme} label="Publish status" icon="add" busy={busy} disabled={!text.trim()} onPress={() => void run(async () => { await chatService.createStory(text.trim(), background); setText(''); setReloadKey((value) => value + 1); })} />
        </View>
      ) : null}
      {loading ? <Loader theme={theme} /> : error ? <ErrorBanner theme={theme} message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : mode === 'statuses' ? (
        stories.length ? stories.map((story) => (
          <DataCard theme={theme} key={story._id} title={story.authorId.name} subtitle={`Expires ${new Date(story.expiresAt).toLocaleTimeString()}`} badge={story.viewed ? 'Viewed' : 'New'}>
            <Pressable onPress={() => void run(async () => { await chatService.viewStory(story._id); setStories((current) => current.map((item) => item._id === story._id ? { ...item, viewed: true } : item)); })} className="min-h-32 justify-center rounded-card p-4" style={{ backgroundColor: story.background }}>
              {story.media?.mimeType.startsWith('image/') ? <Image source={{ uri: story.media.url }} style={{ width: '100%', height: 220, resizeMode: 'contain' }} /> : null}
              <Text className="font-bold text-base text-white">{story.text}</Text>
            </Pressable>
            {story.media?.mimeType.startsWith('video/') ? <ActionChip theme={theme} label="Open video" onPress={() => void run(() => Linking.openURL(story.media!.url))} /> : null}
            {story.authorId._id === userId ? <View className="flex-row gap-2">
              <ActionChip theme={theme} label={`Viewers (${story.viewCount ?? 0})`} disabled={busy} onPress={() => openViewers(story._id)} />
              <ActionChip theme={theme} label="Delete" tone="danger" disabled={busy} onPress={() => Alert.alert('Delete status?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(async () => { await chatService.deleteStory(story._id); setReloadKey((value) => value + 1); }) }])} />
            </View> : null}
            {selected === story._id ? <View className="gap-2"><Text className="font-sans text-sm" style={{ color: palette.secondary }}>{viewers.join('\n') || 'No viewers yet'}</Text>{viewerCursor ? <ActionChip theme={theme} label="More viewers" disabled={busy} onPress={() => openViewers(story._id, viewerCursor)} /> : null}</View> : null}
          </DataCard>
        )) : <EmptyHint theme={theme} title="No statuses" />
      ) : calls.length ? calls.map((call) => {
        const outgoing = call.callerId?._id === userId;
        const peer = outgoing ? call.calleeId : call.callerId;
        return <DataCard theme={theme} key={call._id} title={call.conversationId?.name ?? peer?.name ?? 'Call'} subtitle={`${outgoing ? 'Outgoing' : 'Incoming'} ${call.type} - ${new Date(call.createdAt).toLocaleString()}`} badge={call.state} actions={call.conversationId ? <ActionChip theme={theme} label="Open conversation" onPress={() => router.push({ pathname: '/chat/[conversationId]', params: { conversationId: call.conversationId!._id, name: peer?.name ?? call.conversationId!.name ?? 'Conversation', peerUserId: peer?._id, conversationType: call.conversationId!.type } })} /> : undefined} />;
      }) : <EmptyHint theme={theme} title="No calls yet" />}
      {!loading && !error && cursor ? <ActionChip theme={theme} label="Load more" disabled={busy} onPress={more} /> : null}
    </ScrollView>
    <ChatBottomTabs active={mode === 'statuses' ? 'statuses' : 'calls'} />
    </View>
  );
}