import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/primitives";
import { ChatBottomTabs } from "@/components/chat-bottom-tabs";
import { ChatThemeToggle } from "@/components/chat-theme-toggle";
import { getApiErrorMessage } from "@/services/api";
import { chatService } from "@/services/chat.service";
import { useAppSelector } from "@/store/hooks";
import { chatPalette, useChatTheme } from "@/providers/chat-theme";
import type { ChatContact, Conversation } from "@/types/chat";

type ChatFilter =
  "all" | "unread" | "favourites" | "communities" | "dept" | "archived";
type ConversationMode = "DIRECT" | "GROUP" | "COMMUNITY";
type InboxItem = {
  id: string;
  title: string;
  preview: string;
  time: string;
  unreadCount: number;
  avatar?: string;
  contact?: ChatContact;
  conversation?: Conversation;
  group: boolean;
  sentByMe: boolean;
};

const collectiveCreatorRoles = new Set([
  "ADMIN",
  "CEO",
  "HEAD",
  "MANAGER",
  "PRODUCT_HEAD",
  "MARKETING_HEAD",
  "FINANCE_HEAD",
  "SALES_HEAD",
  "PROJECTS_HEAD",
  "SUPPORT_HEAD",
  "HR_HEAD",
  "DESIGN_HEAD",
  "ENGINEERING_HEAD",
  "PRODUCT_MANAGER",
  "MARKETING_MANAGER",
  "FINANCE_MANAGER",
  "SALES_MANAGER",
  "PROJECTS_MANAGER",
  "SUPPORT_MANAGER",
  "HR_MANAGER",
  "DESIGN_MANAGER",
  "ENGINEERING_MANAGER",
]);
const departmentChatRoles = collectiveCreatorRoles;

const conversationTitle = (conversation: Conversation, userId?: string) =>
  conversation.name ||
  conversation.members.find((member) => member.userId._id !== userId)?.userId
    .name ||
  "Conversation";

const lastMessageLabel = (conversation: Conversation) => {
  const message = conversation.lastMessage;
  if (!message)
    return conversation.type === "DIRECT"
      ? "Start a conversation"
      : "No messages yet";
  if (message.text) return message.text;
  if (message.type === "IMAGE") return "Photo";
  if (message.type === "VIDEO") return "Video";
  if (message.type === "AUDIO") return "Voice message";
  if (message.type === "DOCUMENT") return "Document";
  if (message.type === "LOCATION") return "Location";
  return "Message";
};

const lastMessageIsMine = (conversation: Conversation, userId?: string) => {
  const sender = conversation.lastMessage?.senderId;
  return Boolean(
    sender && (typeof sender === "string" ? sender : sender._id) === userId,
  );
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

export function ChatConversationsView() {
  const router = useRouter();
  const { theme } = useChatTheme();
  const palette = chatPalette[theme];
  const user = useAppSelector((state) => state.auth.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [mode, setMode] = useState<ConversationMode>("DIRECT");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [conversationName, setConversationName] = useState("");
  const [creating, setCreating] = useState(false);
  const [socketOnline, setSocketOnline] = useState(false);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const canCreateCollective = Boolean(
    user?.roles.some((role) => collectiveCreatorRoles.has(role)),
  );
  const showDepartmentTab = canCreateCollective;

  const loadConversations = async (pullToRefresh = false) => {
    if (pullToRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setConversations(await chatService.conversations());
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Unable to load chats."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadContacts = async (pullToRefresh = false, query = "") => {
    if (pullToRefresh) setRefreshing(true);
    else setContactsLoading(true);
    setError("");
    try {
      setContacts(await chatService.contacts(query));
      setContactsLoaded(true);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, "Unable to load contacts."));
    } finally {
      setContactsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadConversations());
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const socket = new WebSocket(chatService.webSocketUrl(accessToken));
    socket.onopen = () => setSocketOnline(true);
    socket.onclose = () => setSocketOnline(false);
    socket.onerror = () => setSocketOnline(false);
    socket.onmessage = (event) => {
      const packet = JSON.parse(event.data) as {
        type: string;
        conversationId?: string;
      };
      if (packet.type === "conversation.created") void loadConversations();
      if (packet.type === "conversation.deleted" && packet.conversationId) {
        setConversations((current) =>
          current.filter(
            (conversation) => conversation._id !== packet.conversationId,
          ),
        );
      }
    };
    return () => socket.close();
  }, [accessToken]);

  const visibleItems = useMemo<InboxItem[]>(() => {
    const query = search.trim().toLowerCase();
    return conversations
      .filter((conversation) =>
        filter === "archived"
          ? Boolean(conversation.mySettings?.archived)
          : !conversation.mySettings?.archived,
      )
      .filter(
        (conversation) =>
          filter === "all" ||
          filter === "archived" ||
          (filter === "unread"
            ? conversation.unreadCount > 0
            : filter === "favourites"
              ? Boolean(conversation.mySettings?.pinned)
              : filter === "communities"
                ? conversation.type === "GROUP" ||
                  conversation.type === "COMMUNITY" ||
                  Boolean(conversation.communityId)
                : filter === "dept"
                  ? conversation.members.some(
                      (member) =>
                        member.userId._id !== user?.user_id &&
                        member.userId.roles?.some((role) =>
                          departmentChatRoles.has(role),
                        ),
                    )
                  : true),
      )
      .filter((conversation) =>
        `${conversationTitle(conversation, user?.user_id)} ${lastMessageLabel(conversation)}`
          .toLowerCase()
          .includes(query),
      )
      .map((conversation) => ({
        id: conversation._id,
        title: conversationTitle(conversation, user?.user_id),
        preview: lastMessageLabel(conversation),
        time: formatTime(conversation.lastMessageAt),
        unreadCount: conversation.unreadCount,
        avatar:
          conversation.type === "DIRECT"
            ? conversation.members.find(
                (member) => member.userId._id !== user?.user_id,
              )?.userId.profile_pic
            : undefined,
        conversation,
        group: conversation.type !== "DIRECT",
        sentByMe: lastMessageIsMine(conversation, user?.user_id),
      }))
      .sort(
        (first, second) =>
          Number(Boolean(second.conversation?.mySettings?.pinned)) -
            Number(Boolean(first.conversation?.mySettings?.pinned)) ||
          +new Date(second.conversation?.lastMessageAt ?? 0) -
            +new Date(first.conversation?.lastMessageAt ?? 0),
      );
  }, [conversations, filter, search, user?.user_id]);

  const isLoading = loading && !refreshing;
  const retry = () => void loadConversations();
  const refresh = () => void loadConversations(true);
  const startNewConversation = () => {
    setComposerOpen(true);
    setMode("DIRECT");
    setSelectedContacts([]);
    setConversationName("");
    if (!contactsLoaded && !contactsLoading) void loadContacts();
  };
  const toggleContact = (contactId: string) =>
    setSelectedContacts((current) =>
      mode === "DIRECT"
        ? [contactId]
        : current.includes(contactId)
          ? current.filter((id) => id !== contactId)
          : [...current, contactId],
    );
  const createConversation = async () => {
    if (mode === "DIRECT" && !selectedContacts.length) {
      Alert.alert("New conversation", "Select a person to start a chat.");
      return;
    }
    if (mode !== "DIRECT" && conversationName.trim().length < 2) {
      Alert.alert("New conversation", `Enter a ${mode.toLowerCase()} name.`);
      return;
    }
    setCreating(true);
    try {
      const conversation =
        mode === "DIRECT"
          ? await chatService.createDirectConversation(selectedContacts[0])
          : await chatService.createConversation({
              type: mode,
              name: conversationName.trim(),
              memberIds: selectedContacts,
            });
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item._id !== conversation._id),
      ]);
      setComposerOpen(false);
      const peer =
        conversation.type === "DIRECT"
          ? conversation.members.find(
              (member) => member.userId._id !== user?.user_id,
            )?.userId
          : undefined;
      const title = peer?.name ?? conversation.name ?? "Conversation";
      router.push({
        pathname: "/chat/[conversationId]",
        params: {
          conversationId: conversation._id,
          name: title,
          avatar: peer?.profile_pic,
          peerUserId: peer?._id,
          conversationType: conversation.type,
          isConversationAdmin: conversation.admins?.includes(
            user?.user_id ?? "",
          )
            ? "true"
            : "false",
        },
      });
    } catch (createError) {
      Alert.alert(
        "New conversation",
        getApiErrorMessage(createError, "Unable to create this conversation."),
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      className="flex-1"
      style={{ backgroundColor: palette.panel }}
    >
      <View
        className="flex-row items-center justify-between border-b px-5 py-3.5"
        style={{ backgroundColor: palette.panel, borderColor: palette.line }}
      >
        <View className="min-w-0 flex-1">
          <Text className="font-extra text-xl" style={{ color: palette.text }}>
            First Chat
          </Text>
          {!socketOnline ? (
            <View className="mt-1 flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-amber-400" />
              <Text
                className="font-medium text-[11px]"
                style={{ color: palette.secondary }}
              >
                Reconnecting
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center gap-3">
          <ChatThemeToggle />
          <Pressable
            accessibilityLabel="New conversation"
            className="h-10 w-10 items-center justify-center rounded-md"
            onPress={startNewConversation}
          >
            <Ionicons
              color={palette.secondary}
              name="chatbox-ellipses-outline"
              size={23}
            />
            <Ionicons
              className="absolute right-2 top-1"
              color={palette.secondary}
              name="add"
              size={12}
            />
          </Pressable>
        </View>
      </View>
      <View
        className="border-b px-4 py-3.5"
        style={{ backgroundColor: palette.panel, borderColor: palette.line }}
      >
        <View
          className="h-10 flex-row items-center gap-3 rounded-full px-4"
          style={{ backgroundColor: palette.raised }}
        >
          <Ionicons color={palette.secondary} name="search" size={19} />
          <TextInput
            className="h-10 flex-1 font-medium text-sm"
            onChangeText={setSearch}
            placeholder="Search or start new chat"
            placeholderTextColor={palette.secondary}
            returnKeyType="search"
            style={{ color: palette.text }}
            value={search}
          />
          {search ? (
            <Pressable
              accessibilityLabel="Clear search"
              onPress={() => setSearch("")}
            >
              <Ionicons
                color={palette.secondary}
                name="close-circle"
                size={17}
              />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          className="mt-3"
          contentContainerClassName="gap-1.5"
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {(
            [
              "all",
              "unread",
              "favourites",
              "communities",
              ...(showDepartmentTab ? ["dept" as const] : []),
            ] as const
          ).map((tab) => (
            <Pressable
              key={tab}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === tab }}
              className="items-center justify-center rounded-full px-4 py-2"
              onPress={() => setFilter(tab)}
              style={{
                backgroundColor:
                  filter === tab
                    ? theme === "light"
                      ? "#d9fdd3"
                      : "#12382c"
                    : palette.raised,
              }}
            >
              <Text
                numberOfLines={1}
                className="font-semibold text-sm"
                style={{
                  color: filter === tab ? palette.accent : palette.secondary,
                }}
              >
                {tab === "all"
                  ? "All"
                  : tab === "unread"
                    ? "Unread"
                    : tab === "favourites"
                      ? "Favourites"
                      : tab === "communities"
                        ? "Groups"
                        : "Dept"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: filter === "archived" }}
        className="flex-row items-center gap-6 border-b px-6 py-4"
        onPress={() => setFilter(filter === "archived" ? "all" : "archived")}
        style={{ backgroundColor: palette.panel, borderColor: palette.line }}
      >
        <Ionicons color={palette.secondary} name="archive-outline" size={21} />
        <Text
          className="font-medium text-base"
          style={{ color: palette.secondary }}
        >
          {filter === "archived" ? "Back to all chats" : "Archived"}
        </Text>
      </Pressable>
      {error ? (
        <Pressable
          accessibilityRole="button"
          className="mx-4 mt-3 rounded-md bg-red-50 px-3 py-2"
          onPress={retry}
        >
          <Text className="font-medium text-xs text-[#b42318]">
            {error} · Tap to retry
          </Text>
        </Pressable>
      ) : null}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={palette.accent} />
          <Text
            className="mt-3 font-medium text-xs"
            style={{ color: palette.secondary }}
          >
            Loading conversations
          </Text>
        </View>
      ) : null}
      <FlatList
        className={isLoading ? "hidden" : "flex-1"}
        style={{ backgroundColor: palette.panel }}
        contentContainerClassName="py-2"
        data={visibleItems}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            onRefresh={refresh}
            refreshing={refreshing}
            tintColor={palette.accent}
          />
        }
        ListEmptyComponent={
          !isLoading && !error ? (
            <EmptyState
              description={
                search
                  ? "Try another name or message."
                  : filter === "archived"
                    ? "Archived conversations will appear here."
                    : "Start a conversation with someone in your workspace."
              }
              icon="chatbubbles-outline"
              title={search ? "No matches found" : "No conversations"}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const conversation = item.conversation!;
          return (
            <Pressable
              accessibilityRole="button"
              className="relative min-h-[76px] flex-row items-center gap-3 border-l-[3px] border-transparent px-4 py-3 active:bg-[#f0f2f5]"
              onPress={() => {
                const peer =
                  conversation.type === "DIRECT"
                    ? conversation.members.find(
                        (member) => member.userId._id !== user?.user_id,
                      )?.userId
                    : undefined;
                router.push({
                  pathname: "/chat/[conversationId]",
                  params: {
                    conversationId: conversation._id,
                    name: item.title,
                    avatar: item.avatar,
                    peerUserId: peer?._id,
                    conversationType: conversation.type,
                    isConversationAdmin: conversation.admins?.includes(
                      user?.user_id ?? "",
                    )
                      ? "true"
                      : "false",
                  },
                });
              }}
            >
              <View
                className="h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border"
                style={{
                  backgroundColor: item.group
                    ? theme === "light"
                      ? "#eaf8ef"
                      : "#12382c"
                    : palette.raised,
                  borderColor: palette.line,
                }}
              >
                {item.avatar ? (
                  <Image
                    className="h-full w-full"
                    source={{ uri: item.avatar }}
                  />
                ) : item.group ? (
                  <Ionicons
                    color={palette.accent}
                    name="people-outline"
                    size={21}
                  />
                ) : (
                  <Text
                    className="font-bold text-xs"
                    style={{ color: palette.text }}
                  >
                    {item.title.trim().slice(0, 2).toUpperCase()}
                  </Text>
                )}
              </View>
              <View className="min-h-[52px] flex-1 justify-center">
                <View className="flex-row items-center justify-between gap-2">
                  <Text
                    numberOfLines={1}
                    className="flex-1 font-bold text-sm"
                    style={{ color: palette.text }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    className="font-semibold text-[10px]"
                    style={{
                      color: item.unreadCount
                        ? palette.accent
                        : palette.secondary,
                    }}
                  >
                    {item.time}
                  </Text>
                </View>
                <View className="mt-1 flex-row items-center gap-2">
                  <Text
                    numberOfLines={1}
                    className="flex-1 font-sans text-xs"
                    style={{ color: palette.secondary }}
                  >
                    {item.preview}
                  </Text>
                  {conversation.mySettings?.pinned ? (
                    <Ionicons color={palette.secondary} name="pin" size={12} />
                  ) : null}
                  {conversation.mySettings?.mutedUntil ? (
                    <Ionicons
                      color={palette.secondary}
                      name="volume-mute"
                      size={13}
                    />
                  ) : null}
                  {item.unreadCount > 0 ? (
                    <View
                      className="min-w-5 items-center rounded-full px-1.5 py-0.5"
                      style={{ backgroundColor: palette.accent }}
                    >
                      <Text className="font-bold text-[10px] text-white">
                        {item.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Pressable
                accessibilityLabel="Conversation options"
                className="h-9 w-8 items-center justify-center"
                onPress={() =>
                  Alert.alert(item.title, "Conversation options", [
                    {
                      text: conversation.mySettings?.pinned ? "Unpin" : "Pin",
                      onPress: async () => {
                        await chatService.updateSettings(conversation._id, {
                          pinned: !conversation.mySettings?.pinned,
                        });
                        void loadConversations();
                      },
                    },
                    {
                      text: conversation.mySettings?.archived
                        ? "Unarchive"
                        : "Archive",
                      onPress: async () => {
                        await chatService.updateSettings(conversation._id, {
                          archived: !conversation.mySettings?.archived,
                        });
                        void loadConversations();
                      },
                    },
                    { text: "Cancel", style: "cancel" },
                  ])
                }
              >
                <Ionicons
                  color={palette.secondary}
                  name="ellipsis-vertical"
                  size={17}
                />
              </Pressable>
            </Pressable>
          );
        }}
      />
      <ChatBottomTabs active="chat" />
      <Modal
        animationType="fade"
        onRequestClose={() => setComposerOpen(false)}
        transparent
        visible={composerOpen}
      >
        <View className="flex-1 justify-center bg-black/55 p-3">
          <View
            className="max-h-[88%] overflow-hidden rounded-md border border-white/20 border-t-4"
            style={{
              backgroundColor: palette.panel,
              borderTopColor: palette.accent,
            }}
          >
            <View
              className="flex-row items-center justify-between border-b px-4 py-3.5"
              style={{ borderColor: palette.line }}
            >
              <View>
                <Text
                  className="font-extra text-lg"
                  style={{ color: palette.text }}
                >
                  New conversation
                </Text>
                <Text
                  className="mt-1 font-sans text-xs"
                  style={{ color: palette.secondary }}
                >
                  Find anyone in the Ricoz workspace.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                className="h-9 w-9 items-center justify-center rounded-md"
                style={{ backgroundColor: palette.raised }}
                onPress={() => setComposerOpen(false)}
              >
                <Ionicons color={palette.secondary} name="close" size={20} />
              </Pressable>
            </View>
            <View
              className="mx-3 mt-3 flex-row rounded-md p-1"
              style={{ backgroundColor: palette.raised }}
            >
              {(["DIRECT", "GROUP", "COMMUNITY"] as const).map((value) => {
                const blocked = value !== "DIRECT" && !canCreateCollective;
                return (
                  <Pressable
                    key={value}
                    disabled={blocked}
                    className="flex-1 flex-row items-center justify-center gap-1 rounded-sm px-1 py-2"
                    style={{
                      backgroundColor:
                        mode === value ? palette.panel : "transparent",
                      opacity: blocked ? 0.45 : 1,
                    }}
                    onPress={() => {
                      setMode(value);
                      setSelectedContacts([]);
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      className="font-bold text-[10px]"
                      style={{
                        color:
                          mode === value ? palette.text : palette.secondary,
                      }}
                    >
                      {value === "DIRECT"
                        ? "One-to-one"
                        : value.charAt(0) + value.slice(1).toLowerCase()}
                    </Text>
                    {blocked ? (
                      <Ionicons
                        color={palette.secondary}
                        name="lock-closed"
                        size={10}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {!canCreateCollective ? (
              <View className="mx-3 mt-2 flex-row items-center gap-2 rounded-md bg-[#fff7ed] px-3 py-2">
                <Ionicons
                  color="#9a3412"
                  name="lock-closed-outline"
                  size={14}
                />
                <Text className="flex-1 font-medium text-[11px] text-[#9a3412]">
                  Your role can create one-to-one chats only.
                </Text>
              </View>
            ) : null}
            <View className="gap-3 p-3">
              {mode !== "DIRECT" ? (
                <TextInput
                  className="h-11 rounded-md border px-3 font-medium text-sm"
                  onChangeText={setConversationName}
                  placeholder={`${mode === "GROUP" ? "Group" : "Community"} name`}
                  placeholderTextColor={palette.secondary}
                  style={{
                    backgroundColor: palette.input,
                    borderColor: palette.line,
                    color: palette.text,
                  }}
                  value={conversationName}
                />
              ) : null}
              <View
                className="h-11 flex-row items-center gap-2 rounded-md border px-3"
                style={{
                  backgroundColor: palette.input,
                  borderColor: palette.line,
                }}
              >
                <Ionicons color={palette.secondary} name="search" size={16} />
                <TextInput
                  className="h-11 flex-1 font-medium text-sm"
                  onChangeText={(value) => {
                    setContactSearch(value);
                    void loadContacts(false, value);
                  }}
                  placeholder="Search people"
                  placeholderTextColor={palette.secondary}
                  style={{ color: palette.text }}
                  value={contactSearch}
                />
              </View>
            </View>
            {contactsLoading ? (
              <ActivityIndicator className="my-3" color={palette.accent} />
            ) : null}
            <FlatList
              className="max-h-[42vh] px-2"
              style={{ backgroundColor: palette.panel }}
              data={contacts}
              keyExtractor={(contact) => contact._id}
              ListEmptyComponent={
                !contactsLoading ? (
                  <Text
                    className="py-8 text-center font-sans text-xs"
                    style={{ color: palette.secondary }}
                  >
                    No people found.
                  </Text>
                ) : null
              }
              renderItem={({ item: contact }) => {
                const selected = selectedContacts.includes(contact._id);
                return (
                  <Pressable
                    className="min-h-[58px] flex-row items-center gap-3 rounded-md border-l-[3px] px-3 py-2.5"
                    style={{
                      backgroundColor: selected
                        ? theme === "light"
                          ? "#eaf8ef"
                          : "#12382c"
                        : "transparent",
                      borderLeftColor: selected
                        ? palette.accent
                        : "transparent",
                    }}
                    onPress={() => toggleContact(contact._id)}
                  >
                    <View
                      className="h-10 w-10 items-center justify-center overflow-hidden rounded-full border"
                      style={{
                        backgroundColor: palette.raised,
                        borderColor: palette.line,
                      }}
                    >
                      {contact.profile_pic ? (
                        <Image
                          className="h-full w-full"
                          source={{ uri: contact.profile_pic }}
                        />
                      ) : (
                        <Text
                          className="font-bold text-xs"
                          style={{ color: palette.text }}
                        >
                          {contact.name.slice(0, 2).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        numberOfLines={1}
                        className="font-bold text-sm"
                        style={{ color: palette.text }}
                      >
                        {contact.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        className="font-sans text-xs"
                        style={{ color: palette.secondary }}
                      >
                        {contact.email}
                      </Text>
                    </View>
                    <View
                      className="h-5 w-5 items-center justify-center rounded-sm border"
                      style={{
                        backgroundColor: selected
                          ? palette.accent
                          : "transparent",
                        borderColor: selected
                          ? palette.accent
                          : palette.secondary,
                      }}
                    >
                      {selected ? (
                        <Ionicons color="white" name="checkmark" size={13} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
            <View
              className="flex-row justify-end gap-2 border-t p-3"
              style={{
                backgroundColor: palette.raised,
                borderColor: palette.line,
              }}
            >
              <Pressable
                className="h-10 items-center justify-center rounded-md px-4"
                onPress={() => setComposerOpen(false)}
              >
                <Text
                  className="font-bold text-sm"
                  style={{ color: palette.secondary }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                className="h-10 min-w-28 flex-row items-center justify-center gap-2 rounded-md px-4"
                style={{ backgroundColor: palette.accent }}
                disabled={creating}
                onPress={() => {
                  void createConversation();
                }}
              >
                {creating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : null}
                <Text className="font-bold text-sm text-white">
                  {creating
                    ? "Creating..."
                    : mode === "DIRECT"
                      ? "Start chat"
                      : `Create ${mode.toLowerCase()}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
