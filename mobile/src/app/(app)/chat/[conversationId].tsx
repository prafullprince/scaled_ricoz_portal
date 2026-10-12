import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { KeyboardStickyView } from 'react-native-keyboard-controller';

import { cn } from "@/components/ui/primitives";
import { getApiErrorMessage } from "@/services/api";
import { chatService } from "@/services/chat.service";
import { useChatCalls } from '@/providers/call-context';
import { chatPalette, useChatTheme } from '@/providers/chat-theme';
import { useAppSelector } from "@/store/hooks";
import type { ChatContact, ChatMessage, Conversation } from "@/types/chat";

const senderId = (message: ChatMessage) =>
  typeof message.senderId === "string"
    ? message.senderId
    : message.senderId._id;
const receiptUserId = (user: string | { _id: string }) =>
  typeof user === "string" ? user : user._id;
const hasOtherParticipantReceipt = (
  receipts: ChatMessage["readBy"],
  currentUserId?: string,
) =>
  receipts?.some((receipt) => receiptUserId(receipt) !== currentUserId) ??
  false;
const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
const dayLabel = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "TODAY";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";
  return date
    .toLocaleDateString([], {
      month: "long",
      day: "numeric",
      year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    })
    .toUpperCase();
};

export default function ConversationScreen() {
  const { conversationId, name, avatar, peerUserId, conversationType, isConversationAdmin } = useLocalSearchParams<{
    conversationId: string;
    name?: string;
    avatar?: string;
    peerUserId?: string;
    conversationType?: string;
    isConversationAdmin?: string;
  }>();
  const router = useRouter();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const currentUser = useAppSelector((state) => state.auth.user);
  const userId = currentUser?.user_id;
  const canStartDirectCall = Boolean(currentUser && !currentUser.roles.some((role) => role === 'INTERN' || role === 'EMPLOYEE'));
  const { callsSupported, activeGroupCalls, syncActiveGroupCall, startDirectCall, startGroupCall, joinGroupCall } = useChatCalls();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const messageSequence = useRef(0);
  const messageClientPrefix = useRef("");
  const insets = useSafeAreaInsets();
  const { theme } = useChatTheme();
  const palette = chatPalette[theme];
  const title = typeof name === "string" && name.length ? name : "Chat";
  const collective = conversationType === 'GROUP' || conversationType === 'COMMUNITY';
  const activeGroupCall = activeGroupCalls.get(conversationId);
  const isGroupAdmin = isConversationAdmin === 'true';
  useEffect(() => {
    chatService.messages(conversationId)
      .then((items) => {
        setMessages(items);
        const last = items.at(-1);
        if (last)
          chatService.markRead(conversationId, last._id).catch(() => undefined);
      })
      .catch((error) =>
        Alert.alert(
          "Chat",
          getApiErrorMessage(error, "Unable to load messages."),
        ),
      );
  }, [conversationId]);
  useEffect(() => {
    chatService.conversations()
      .then((conversations) => setConversation(conversations.find((item) => item._id === conversationId) ?? null))
      .catch(() => undefined);
  }, [conversationId]);
  useEffect(() => {
    if (!detailsOpen || !addingMembers || !collective) return;
    let active = true;
    chatService.contacts(memberSearch)
      .then((items) => { if (active) setContacts(items); })
      .catch((error) => { if (active) Alert.alert('Group members', getApiErrorMessage(error, 'Unable to load people.')); });
    return () => { active = false; };
  }, [addingMembers, collective, detailsOpen, memberSearch]);
  useEffect(() => {
    if (!collective) return;
    chatService.activeCall(conversationId)
      .then((activeCall) => syncActiveGroupCall(conversationId, activeCall ? { type: activeCall.type, startedByName: activeCall.startedByName } : null))
      .catch(() => undefined);
  }, [collective, conversationId, syncActiveGroupCall]);
  useEffect(() => {
    messageClientPrefix.current = `${userId ?? "mobile"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }, [userId]);
  useEffect(() => {
    if (!accessToken) return;
    const socket = new WebSocket(chatService.webSocketUrl(accessToken));
    socket.onmessage = (event) => {
      const packet = JSON.parse(event.data) as {
        type: string;
        conversationId?: string;
        message?: ChatMessage;
        messageId?: string;
        userId?: string;
        readThroughAt?: string;
        receipt?: "delivered" | "read";
      };
      if (packet.type === "conversation.deleted" && packet.conversationId === conversationId) {
        Alert.alert("Project completed", "This project group was removed because all assigned work is complete.");
        router.replace('/chat');
        return;
      }
      if (
        packet.type === "message.created" &&
        packet.message?.conversationId === conversationId
      ) {
        setMessages((current) => [
          ...current.filter(
            (item) => item.clientId !== packet.message?.clientId,
          ),
          packet.message!,
        ]);
      }
      if (packet.conversationId !== conversationId || packet.userId === userId)
        return;
      if (
        packet.type === "conversation.read" &&
        packet.userId &&
        packet.readThroughAt
      ) {
        const readThrough = new Date(packet.readThroughAt).getTime();
        setMessages((current) =>
          current.map((message) =>
            new Date(message.createdAt).getTime() <= readThrough
              ? {
                  ...message,
                  readBy: [
                    ...(message.readBy ?? []).filter(
                      (reader) => receiptUserId(reader) !== packet.userId,
                    ),
                    packet.userId!,
                  ],
                }
              : message,
          ),
        );
      }
      if (
        packet.type === "message.receipt" &&
        packet.receipt === "delivered" &&
        packet.messageId &&
        packet.userId
      ) {
        setMessages((current) =>
          current.map((message) =>
            message._id === packet.messageId
              ? {
                  ...message,
                  deliveredTo: [
                    ...(message.deliveredTo ?? []).filter(
                      (reader) => receiptUserId(reader) !== packet.userId,
                    ),
                    packet.userId!,
                  ],
                }
              : message,
          ),
        );
      }
    };
    return () => socket.close();
  }, [accessToken, conversationId, userId, router]);
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const show = Keyboard.addListener(showEvent, () => {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    return () => {
      show.remove();
    };
  }, []);

  const submit = async (input: {
    text: string;
    type?: ChatMessage["type"];
    attachments?: ChatMessage["attachments"];
    location?: ChatMessage["location"];
  }) => {
    const clientId = `${messageClientPrefix.current || userId || "mobile"}-${++messageSequence.current}`;
    const optimistic: ChatMessage = {
      _id: clientId,
      conversationId,
      clientId,
      senderId: userId ?? "",
      type: input.type ?? "TEXT",
      text: input.text,
      attachments: input.attachments ?? [],
      location: input.location,
      createdAt: new Date().toISOString(),
      pending: true,
    };
    setMessages((current) => [...current, optimistic]);
    setText("");
    setSending(true);
    try {
      const acknowledgement = await chatService.send(conversationId, {
        clientId,
        ...input,
      });
      if (acknowledgement.queued && acknowledgement.clientId === clientId)
        setMessages((current) =>
          current.map((message) =>
            message.clientId === clientId
              ? { ...message, pending: false }
              : message,
          ),
        );
    } catch (error) {
      setMessages((current) =>
        current.filter((item) => item.clientId !== clientId),
      );
      Alert.alert(
        "Message not sent",
        getApiErrorMessage(error, "Please try again."),
      );
    } finally {
      setSending(false);
    }
  };
  const attach = async (kind: "image" | "document" | "location") => {
    setAttachmentsOpen(false);
    try {
      if (kind === "location") {
        await submit({
          text: "",
          type: "LOCATION",
          location: await chatService.currentLocation(),
        });
        return;
      }
      const attachment =
        kind === "image"
          ? await chatService.pickImage()
          : await chatService.pickDocument();
      if (attachment)
        await submit({
          text: "",
          type: kind === "image" ? "IMAGE" : "DOCUMENT",
          attachments: [attachment],
        });
    } catch (error) {
      Alert.alert(
        "Attachment",
        getApiErrorMessage(error, "Unable to attach this item."),
      );
    }
  };
  const filteredMessages = search.trim()
    ? messages.filter((message) =>
        message.text.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : messages;

  const startCall = async (type: 'audio' | 'video') => {
    try {
      if (collective) {
        await startGroupCall({ conversationId, conversationName: title, type });
      } else {
        if (!peerUserId) throw new Error('Could not identify the other person in this conversation.');
        await startDirectCall({ conversationId, peerUserId, peerName: title, type });
      }
    } catch (error) {
      Alert.alert('Unable to start call', getApiErrorMessage(error, 'Please try again.'));
    }
  };

  const joinCall = async () => {
    try {
      await joinGroupCall({ conversationId, conversationName: title });
    } catch (error) {
      Alert.alert('Unable to join call', getApiErrorMessage(error, 'The call may have ended.'));
    }
  };

  const updateConversationSettings = async (settings: { archived?: boolean; pinned?: boolean; mutedUntil?: string | null }) => {
    try {
      const updated = await chatService.updateSettings(conversationId, settings);
      setConversation(updated);
      if (settings.archived) {
        setDetailsOpen(false);
        router.replace('/chat');
      }
    } catch (error) {
      Alert.alert('Conversation', getApiErrorMessage(error, 'Unable to update conversation settings.'));
    }
  };

  const sharedAttachments = messages.flatMap((message) => message.attachments);
  const displayedMembers = conversation?.type === 'DIRECT'
    ? conversation.members.filter((member) => member.userId._id !== userId)
    : conversation?.members ?? [];
  const canManageMembers = Boolean(collective && (isGroupAdmin || conversation?.admins?.includes(userId ?? '')));
  const availableContacts = contacts.filter((contact) => !conversation?.members.some((member) => member.userId._id === contact._id));

  const addSelectedMembers = async () => {
    if (!selectedContacts.length || detailsBusy) return;
    setDetailsBusy(true);
    try {
      setConversation(await chatService.addMembers(conversationId, selectedContacts));
      setSelectedContacts([]);
      setAddingMembers(false);
    } catch (error) {
      Alert.alert('Group members', getApiErrorMessage(error, 'Unable to add members.'));
    } finally {
      setDetailsBusy(false);
    }
  };

  const changeMemberRole = async (memberId: string, currentlyAdmin: boolean) => {
    try {
      setConversation(currentlyAdmin
        ? await chatService.demoteAdmin(conversationId, memberId)
        : await chatService.promoteAdmin(conversationId, memberId));
    } catch (error) {
      Alert.alert('Group members', getApiErrorMessage(error, 'Unable to update this member.'));
    }
  };

  const removeMember = (member: (typeof displayedMembers)[number]) => {
    Alert.alert('Remove member?', `Remove ${member.userId.name} from this conversation?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        void chatService.removeMember(conversationId, member.userId._id)
          .then(setConversation)
          .catch((error) => Alert.alert('Group members', getApiErrorMessage(error, 'Unable to remove this member.')));
      } },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1" style={{ backgroundColor: palette.history }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1">
          <View className="min-h-[64px] flex-row flex-wrap items-center gap-2 border-b px-3 py-2" style={{ backgroundColor: palette.panel, borderColor: palette.line }}>
            <Pressable
              accessibilityLabel="Back to conversations"
              className="h-10 w-9 items-center justify-center rounded-md"
              onPress={() => router.replace('/chat')}
            >
              <Ionicons color={palette.secondary} name="arrow-back" size={21} />
            </Pressable>
            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full border" style={{ backgroundColor: palette.raised, borderColor: palette.line }}>
              {avatar ? (
                <Image className="h-full w-full" source={{ uri: avatar }} />
              ) : (
                <Text className="font-bold text-xs" style={{ color: palette.text }}>
                  {title.trim().slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Conversation details" className="min-w-[120px] flex-1 pl-1" onPress={() => setDetailsOpen(true)}>
              <Text
                numberOfLines={1}
                className="font-extra text-sm"
                style={{ color: palette.text }}
              >
                {title}
              </Text>
              <Text className="font-medium text-[10px]" style={{ color: palette.secondary }}>
                {collective ? `${conversation?.members.length ?? '...'} members` : 'tap for contact info'}
              </Text>
            </Pressable>
            <View className="ml-auto flex-row items-center gap-1">
            {callsSupported && collective && activeGroupCall ? (
              <Pressable
                accessibilityLabel="Join active call"
                className="h-9 flex-row items-center gap-1 rounded-md bg-[#16a34a] px-2.5"
                onPress={() => { void joinCall(); }}
              >
                <Ionicons color="white" name={activeGroupCall.type === 'video' ? 'videocam' : 'call'} size={15} />
                <Text className="font-bold text-[11px] text-white">Join</Text>
              </Pressable>
            ) : null}
            {callsSupported && (!collective || (isGroupAdmin && !activeGroupCall)) ? (
              <>
                <Pressable
                  accessibilityLabel="Start video call"
                  accessibilityHint={!collective && !canStartDirectCall ? 'Your role can receive calls but cannot start them' : undefined}
                  disabled={!collective && !canStartDirectCall}
                  className="h-9 w-9 items-center justify-center rounded-md disabled:opacity-35"
                  onPress={() => { void startCall('video'); }}
                >
                  <Ionicons color={palette.secondary} name="videocam-outline" size={19} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Start audio call"
                  accessibilityHint={!collective && !canStartDirectCall ? 'Your role can receive calls but cannot start them' : undefined}
                  disabled={!collective && !canStartDirectCall}
                  className="h-9 w-9 items-center justify-center rounded-md disabled:opacity-35"
                  onPress={() => { void startCall('audio'); }}
                >
                  <Ionicons color={palette.secondary} name="call-outline" size={18} />
                </Pressable>
              </>
            ) : null}
            <Pressable
              accessibilityLabel="Search messages"
              className="h-9 w-9 items-center justify-center rounded-md"
              onPress={() => {
                setSearchOpen((open) => !open);
                setSearch("");
              }}
            >
              <Ionicons color={palette.secondary} name="search" size={19} />
            </Pressable>
            <Pressable
              accessibilityLabel="Conversation options"
              className="h-9 w-8 items-center justify-center rounded-md"
              onPress={() => setDetailsOpen(true)}
            >
              <Ionicons color={palette.secondary} name="ellipsis-vertical" size={18} />
            </Pressable>
            </View>
          </View>
          {searchOpen ? (
            <View className="flex-row items-center gap-2 border-b px-4" style={{ backgroundColor: palette.panel, borderColor: palette.line }}>
              <Ionicons color={palette.secondary} name="search" size={18} />
              <TextInput
                autoFocus
                className="h-11 flex-1 font-medium text-sm"
                onChangeText={setSearch}
                placeholder="Search messages"
                placeholderTextColor={palette.secondary}
                style={{ color: palette.text }}
                value={search}
              />
              <Pressable
                accessibilityLabel="Close search"
                onPress={() => {
                  setSearchOpen(false);
                  setSearch("");
                }}
              >
                <Ionicons color={palette.secondary} name="close" size={19} />
              </Pressable>
            </View>
          ) : null}
          <FlatList
            ref={listRef}
            className={cn('chat-canvas flex-1', theme === 'dark' && 'chat-canvas-dark')}
            style={{ backgroundColor: palette.history }}
            contentContainerClassName="flex-grow gap-1 px-3 py-4"
            data={filteredMessages}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center">
                <View className="rounded-md border px-4 py-2" style={{ backgroundColor: palette.panel, borderColor: palette.line }}>
                  <Text className="font-medium text-xs" style={{ color: palette.secondary }}>
                    {search
                      ? "No matching messages"
                      : "Messages are end-to-end encrypted"}
                  </Text>
                </View>
              </View>
            }
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            renderItem={({ item, index }) => {
              const own = senderId(item) === userId;
              const readByOther = hasOtherParticipantReceipt(
                item.readBy,
                userId,
              );
              const deliveredToOther =
                item.deliveredTo?.some(
                  (recipient) => receiptUserId(recipient) !== userId,
                ) ?? false;
              const showDay =
                index === 0 ||
                dayLabel(item.createdAt) !==
                  dayLabel(filteredMessages[index - 1].createdAt);
              return (
                <View>
                  {showDay ? (
                    <View className="my-3 self-center rounded-sm border px-3 py-1.5" style={{ backgroundColor: palette.panel, borderColor: palette.line }}>
                      <Text className="font-bold text-[10px]" style={{ color: palette.secondary }}>
                        {dayLabel(item.createdAt)}
                      </Text>
                    </View>
                  ) : null}
                  <View
                    className={cn(
                      "mb-1 max-w-[86%] rounded-lg border px-3.5 pb-2 pt-2.5 shadow-sm",
                      own ? 'self-end' : 'self-start',
                      item.pending && "opacity-60",
                    )}
                    style={{ backgroundColor: own ? palette.ownMessage : palette.otherMessage, borderColor: palette.line }}
                  >
                    {!own && typeof item.senderId !== "string" ? (
                      <Text className="mb-1 font-extra text-[11px]" style={{ color: palette.accent }}>
                        {item.senderId.name}
                      </Text>
                    ) : null}
                    {item.text ? (
                      <Text className="font-sans text-sm leading-5" style={{ color: palette.text }}>
                        {item.text}
                      </Text>
                    ) : null}
                    {item.attachments.map((attachment) => (
                      <Pressable
                        key={attachment.url}
                        className="mt-1"
                        onPress={() => {
                          void Linking.openURL(attachment.url);
                        }}
                      >
                        {attachment.mimeType.startsWith("image/") ? (
                          <Image
                            className="mb-1 h-44 w-56 max-w-full rounded-lg bg-[#e9edef]"
                            resizeMode="cover"
                            source={{ uri: attachment.url }}
                          />
                        ) : null}
                        <View className="flex-row items-center gap-2 rounded-sm p-2" style={{ backgroundColor: palette.raised }}>
                          <Ionicons
                            color={palette.accent}
                            name={
                              attachment.mimeType.startsWith("image/")
                                ? "image-outline"
                                : "document-text-outline"
                            }
                            size={20}
                          />
                          <Text
                            numberOfLines={1}
                            className="max-w-48 flex-1 font-semibold text-[12px]"
                            style={{ color: palette.text }}
                          >
                            {attachment.name}
                          </Text>
                          <Ionicons
                            color={palette.secondary}
                            name="download-outline"
                            size={17}
                          />
                        </View>
                      </Pressable>
                    ))}
                    {item.location ? (
                      <Pressable
                        onPress={() => {
                          void Linking.openURL(
                            `https://maps.google.com/?q=${item.location!.latitude},${item.location!.longitude}`,
                          );
                        }}
                      >
                        <Text className="font-semibold text-[13px]" style={{ color: palette.accent }}>
                          Open shared location
                        </Text>
                      </Pressable>
                    ) : null}
                    <View className="mt-0.5 flex-row items-center justify-end gap-1">
                      {item.pending ? (
                        <Ionicons
                          color={palette.secondary}
                          name="time-outline"
                          size={12}
                        />
                      ) : null}
                      <Text className="font-sans text-[10px]" style={{ color: palette.secondary }}>
                        {timeLabel(item.createdAt)}
                      </Text>
                      {own && !item.pending ? (
                        <Ionicons
                          color={readByOther ? '#53bdeb' : palette.secondary}
                          name={
                            deliveredToOther ? "checkmark-done" : "checkmark"
                          }
                          size={15}
                        />
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            }}
          />
          <KeyboardStickyView className="z-10">
          {attachmentsOpen ? (
            <View className="flex-row gap-2 border-t px-3 pb-2 pt-3" style={{ backgroundColor: palette.composer, borderColor: palette.line }}>
              {(
                [
                  ["image", "Image", "images-outline"],
                  ["document", "Document", "document-text-outline"],
                  ["location", "Location", "location-outline"],
                ] as const
              ).map(([kind, label, icon]) => (
                <Pressable
                  key={kind}
                  className="min-h-[54px] flex-1 items-center justify-center gap-1 rounded-md"
                  style={{ backgroundColor: palette.raised }}
                  onPress={() => {
                    void attach(kind);
                  }}
                >
                  <Ionicons color={palette.accent} name={icon} size={20} />
                  <Text className="font-medium text-[10px]" style={{ color: palette.secondary }}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View
            className="flex-row items-end gap-1.5 border-t px-2.5 pt-2.5"
            style={{
              backgroundColor: palette.composer,
              borderColor: palette.line,
              paddingBottom: Math.max(insets.bottom, 12),
            }}
          >
            <Pressable
              accessibilityLabel="Choose emoji"
              className="mb-0.5 h-10 w-10 items-center justify-center rounded-md"
            >
              <Ionicons color={palette.secondary} name="happy-outline" size={21} />
            </Pressable>
            <Pressable
              accessibilityLabel="Open attachments"
              className="mb-0.5 h-10 w-10 items-center justify-center rounded-md"
              onPress={() => setAttachmentsOpen((open) => !open)}
            >
              <Ionicons
                color={palette.secondary}
                name={attachmentsOpen ? "close" : "attach"}
                size={21}
              />
            </Pressable>
            <View className="min-h-11 flex-1 flex-row items-end rounded-full border px-1" style={{ backgroundColor: palette.input, borderColor: palette.line }}>
              <TextInput
                className="max-h-28 min-h-10 flex-1 px-3 py-2.5 font-sans text-sm"
                multiline
                onChangeText={setText}
                placeholder="Type a message"
                placeholderTextColor={palette.secondary}
                style={{ color: palette.text }}
                value={text}
              />
            </View>
            <Pressable
              accessibilityLabel="Send"
              className={cn(
                "mb-0.5 h-10 w-10 items-center justify-center rounded-full shadow-sm",
                (sending || !text.trim()) && "opacity-50",
              )}
              disabled={sending || !text.trim()}
              onPress={() => submit({ text: text.trim() })}
              style={{ backgroundColor: palette.accent }}
            >
              <Ionicons color={theme === 'dark' ? '#082a16' : 'white'} name="send" size={18} />
            </Pressable>
          </View>
          </KeyboardStickyView>
      </View>
      <Modal animationType="slide" onRequestClose={() => setDetailsOpen(false)} transparent visible={detailsOpen}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[88%] overflow-hidden rounded-t-xl" style={{ backgroundColor: palette.raised }}>
            <View className="flex-row items-center justify-between border-b px-4 py-3" style={{ backgroundColor: palette.panel, borderColor: palette.line }}>
              <Text className="font-bold text-base" style={{ color: palette.text }}>{collective ? 'Group info' : 'Contact info'}</Text>
              <Pressable accessibilityLabel="Close conversation details" className="h-9 w-9 items-center justify-center rounded-full" onPress={() => setDetailsOpen(false)} style={{ backgroundColor: palette.raised }}>
                <Ionicons color={palette.secondary} name="close" size={20} />
              </Pressable>
            </View>
            <ScrollView className="flex-1" contentContainerClassName="gap-2 pb-6" keyboardShouldPersistTaps="handled" style={{ backgroundColor: palette.raised }}>
              <View className="items-center px-5 py-6" style={{ backgroundColor: palette.panel }}>
                <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: theme === 'light' ? '#eaf8ef' : '#12382c' }}>
                  {avatar ? <Image className="h-full w-full" source={{ uri: avatar }} /> : <Ionicons color={palette.accent} name={collective ? 'people' : 'person'} size={32} />}
                </View>
                <Text className="mt-3 font-bold text-xl" style={{ color: palette.text }}>{title}</Text>
                <Text className="mt-1 text-center font-sans text-sm" style={{ color: palette.secondary }}>{collective ? `${conversation?.members.length ?? 0} participants` : 'Ricoz contact'}</Text>
              </View>
              <View className="gap-3 p-4" style={{ backgroundColor: palette.panel }}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-bold text-sm" style={{ color: palette.text }}>Media, links and docs</Text>
                  <Text className="font-medium text-xs" style={{ color: palette.secondary }}>{sharedAttachments.length}</Text>
                </View>
                {sharedAttachments.length ? sharedAttachments.map((attachment, index) => (
                  <Pressable key={`${attachment.url}-${index}`} className="flex-row items-center gap-3 rounded-md p-3" onPress={() => { void Linking.openURL(attachment.url); }} style={{ backgroundColor: palette.raised }}>
                    <Ionicons color={palette.accent} name={attachment.mimeType.startsWith('image/') ? 'image-outline' : 'document-text-outline'} size={20} />
                    <Text numberOfLines={1} className="flex-1 font-medium text-sm" style={{ color: palette.text }}>{attachment.name}</Text>
                    <Ionicons color={palette.secondary} name="open-outline" size={16} />
                  </Pressable>
                )) : <Text className="font-sans text-xs" style={{ color: palette.secondary }}>No shared media yet</Text>}
              </View>
              <View className="p-2" style={{ backgroundColor: palette.panel }}>
                <Pressable className="flex-row items-center gap-3 rounded-md px-3 py-3 active:bg-[#f0f2f5]" onPress={() => void updateConversationSettings({ pinned: !conversation?.mySettings?.pinned })}>
                  <Ionicons color={palette.secondary} name="pin-outline" size={19} />
                  <Text className="font-medium text-sm" style={{ color: palette.text }}>{conversation?.mySettings?.pinned ? 'Unpin conversation' : 'Pin conversation'}</Text>
                </Pressable>
                <Pressable className="flex-row items-center gap-3 rounded-md px-3 py-3 active:bg-[#f0f2f5]" onPress={() => void updateConversationSettings({ mutedUntil: conversation?.mySettings?.mutedUntil ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() })}>
                  <Ionicons color={palette.secondary} name="volume-mute-outline" size={19} />
                  <Text className="font-medium text-sm" style={{ color: palette.text }}>{conversation?.mySettings?.mutedUntil ? 'Unmute notifications' : 'Mute for 8 hours'}</Text>
                </Pressable>
                <Pressable className="flex-row items-center gap-3 rounded-md px-3 py-3 active:bg-[#f0f2f5]" onPress={() => void updateConversationSettings({ archived: true })}>
                  <Ionicons color={palette.secondary} name="archive-outline" size={19} />
                  <Text className="font-medium text-sm" style={{ color: palette.text }}>Archive conversation</Text>
                </Pressable>
              </View>
              <View className="gap-3 p-4" style={{ backgroundColor: palette.panel }}>
                <View className="flex-row items-center justify-between">
                  <Text className="font-bold text-sm" style={{ color: palette.text }}>{collective ? `${conversation?.members.length ?? 0} participants` : 'Contact details'}</Text>
                  {canManageMembers ? <Pressable accessibilityRole="button" className="flex-row items-center gap-1 rounded-md px-2 py-1 active:bg-[#eaf8ef]" onPress={() => { setAddingMembers((current) => !current); setSelectedContacts([]); }}><Ionicons color="#008069" name={addingMembers ? 'close' : 'person-add-outline'} size={17} /><Text className="font-bold text-xs text-[#008069]">{addingMembers ? 'Cancel' : 'Add'}</Text></Pressable> : null}
                </View>
                {addingMembers ? (
                  <View className="gap-2 rounded-md p-3" style={{ backgroundColor: palette.raised }}>
                    <View className="h-10 flex-row items-center gap-2 rounded-md border bg-white px-3" style={{ backgroundColor: palette.panel, borderColor: palette.line }}>
                      <Ionicons color={palette.secondary} name="search" size={16} />
                      <TextInput className="h-10 flex-1 font-medium text-sm" onChangeText={setMemberSearch} placeholder="Search people" placeholderTextColor={palette.secondary} style={{ color: palette.text }} value={memberSearch} />
                    </View>
                    <ScrollView className="max-h-44" nestedScrollEnabled>
                      {availableContacts.map((contact) => {
                        const selected = selectedContacts.includes(contact._id);
                        return <Pressable key={contact._id} className="flex-row items-center gap-2 rounded-md px-2 py-2" onPress={() => setSelectedContacts((current) => selected ? current.filter((id) => id !== contact._id) : [...current, contact._id])} style={{ backgroundColor: selected ? (theme === 'light' ? '#eaf8ef' : '#12382c') : 'transparent' }}>
                          <View className="h-8 w-8 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: theme === 'light' ? '#eaf8ef' : '#12382c' }}>{contact.profile_pic ? <Image className="h-full w-full" source={{ uri: contact.profile_pic }} /> : <Text className="font-bold text-[10px]" style={{ color: palette.accent }}>{contact.name.slice(0, 2).toUpperCase()}</Text>}</View>
                          <View className="min-w-0 flex-1"><Text numberOfLines={1} className="font-semibold text-xs" style={{ color: palette.text }}>{contact.name}</Text><Text numberOfLines={1} className="font-sans text-[10px]" style={{ color: palette.secondary }}>{contact.email}</Text></View>
                          <Ionicons color={selected ? palette.accent : palette.secondary} name={selected ? 'checkbox' : 'square-outline'} size={19} />
                        </Pressable>;
                      })}
                      {!availableContacts.length ? <Text className="py-3 text-center font-sans text-xs" style={{ color: palette.secondary }}>No people to add</Text> : null}
                    </ScrollView>
                    <Pressable accessibilityRole="button" disabled={!selectedContacts.length || detailsBusy} className={`min-h-10 flex-row items-center justify-center gap-2 rounded-md px-3 ${!selectedContacts.length || detailsBusy ? 'opacity-50' : ''}`} onPress={() => void addSelectedMembers()} style={{ backgroundColor: palette.accent }}>
                      {detailsBusy ? <Ionicons color="white" name="hourglass-outline" size={15} /> : null}
                      <Text className="font-bold text-xs text-white">{detailsBusy ? 'Adding...' : `Add ${selectedContacts.length || 'members'}`}</Text>
                    </Pressable>
                  </View>
                ) : null}
                {displayedMembers.map((member) => (
                  <View key={member.userId._id} className="flex-row items-center gap-2">
                    <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: theme === 'light' ? '#eaf8ef' : '#12382c' }}>
                      {member.userId.profile_pic ? <Image className="h-full w-full" source={{ uri: member.userId.profile_pic }} /> : <Text className="font-bold text-xs" style={{ color: palette.accent }}>{member.userId.name.slice(0, 2).toUpperCase()}</Text>}
                    </View>
                    <View className="min-w-0 flex-1">
                      <View className="flex-row items-center gap-1.5"><Text numberOfLines={1} className="shrink font-semibold text-sm" style={{ color: palette.text }}>{member.userId._id === userId ? 'You' : member.userId.name}</Text>{conversation?.admins?.includes(member.userId._id) ? <Text className="rounded-sm px-1.5 py-0.5 font-bold text-[9px]" style={{ backgroundColor: theme === 'light' ? '#eaf8ef' : '#12382c', color: palette.accent }}>ADMIN</Text> : null}</View>
                      <Text numberOfLines={1} className="font-sans text-xs" style={{ color: palette.secondary }}>{member.userId.email}</Text>
                    </View>
                    {canManageMembers && member.userId._id !== userId && member.userId._id !== conversation?.createdBy ? <>
                      <Pressable accessibilityLabel={conversation?.admins?.includes(member.userId._id) ? `Remove ${member.userId.name} as admin` : `Make ${member.userId.name} admin`} className="h-9 w-9 items-center justify-center rounded-full" onPress={() => void changeMemberRole(member.userId._id, Boolean(conversation?.admins?.includes(member.userId._id)))}><Ionicons color={palette.accent} name={conversation?.admins?.includes(member.userId._id) ? 'shield-half-outline' : 'shield-checkmark-outline'} size={17} /></Pressable>
                      <Pressable accessibilityLabel={`Remove ${member.userId.name}`} className="h-9 w-9 items-center justify-center rounded-full active:bg-red-50" onPress={() => removeMember(member)}><Ionicons color="#b42318" name="person-remove-outline" size={17} /></Pressable>
                    </> : null}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
