import { Ionicons } from "@expo/vector-icons";
import {
  AudioSession,
  isTrackReference,
  LiveKitRoom,
  useLocalParticipant,
  useTracks,
  VideoTrack,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  mediaDevices,
  MediaStream as NativeMediaStream,
  RTCPeerConnection,
  RTCView,
} from "@livekit/react-native-webrtc";

import { chatService } from "@/services/chat.service";
import { useAppSelector } from "@/store/hooks";
import {
  CallContext,
  type CallType,
  type DirectCall,
  type GroupCall,
} from "@/providers/call-context";

const restrictedCallRoles = new Set(["INTERN", "EMPLOYEE"]);
type NativeSessionDescription = { type: string | null; sdp: string };

function isCurrentDirectCall(ref: { current: DirectCall | null }, callId: string) {
  return ref.current?.callId === callId;
}

type CallSignal = {
  type: string;
  callId?: string;
  callType?: CallType;
  conversationId?: string;
  targetUserId?: string;
  userId?: string;
  callerName?: string;
  sdp?: NativeSessionDescription;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  message?: string;
  startedByName?: string;
  conversationName?: string;
};

function GroupRoom({
  call,
  onLeave,
}: {
  call: GroupCall;
  onLeave: () => void;
}) {
  useEffect(() => {
    let mounted = true;
    void AudioSession.startAudioSession().catch(() => undefined);
    return () => {
      if (mounted) void AudioSession.stopAudioSession().catch(() => undefined);
      mounted = false;
    };
  }, []);
  return (
    <LiveKitRoom
      serverUrl={call.url}
      token={call.token}
      connect
      audio
      video={call.type === "video"}
      onDisconnected={onLeave}
      onError={(error) => Alert.alert("Call", error.message)}
      options={{ adaptiveStream: { pixelDensity: "screen" } }}
    >
      <GroupRoomControls call={call} onLeave={onLeave} />
    </LiveKitRoom>
  );
}

function GroupRoomControls({
  call,
  onLeave,
}: {
  call: GroupCall;
  onLeave: () => void;
}) {
  const room = useTracks([Track.Source.Camera]);
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();
  return (
    <View className="flex-1 bg-[#111827] px-4 pb-8 pt-5">
      <View className="mb-4">
        <Text className="font-extra text-xl text-white">
          {call.conversationName}
        </Text>
        <Text className="mt-1 font-medium text-xs text-gray-300">
          {call.type === "video" ? "Video call" : "Audio call"} · {room.length}{" "}
          camera tracks
        </Text>
      </View>
      {call.type === "video" ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="flex-row flex-wrap justify-center gap-3"
        >
          {room.map((track, index) =>
            isTrackReference(track) ? (
              <VideoTrack
                key={`${track.participant.identity}-${track.publication.trackSid}`}
                trackRef={track}
                style={{
                  width: "47%",
                  height: 224,
                  borderRadius: 12,
                  backgroundColor: "#1f2937",
                }}
              />
            ) : (
              <View
                key={`placeholder-${index}`}
                className="h-56 w-[47%] items-center justify-center rounded-xl bg-gray-800"
              >
                <Ionicons color="#9ca3af" name="person" size={42} />
                <Text className="mt-2 font-medium text-xs text-white">
                  Waiting for video
                </Text>
              </View>
            ),
          )}
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center">
          <View className="h-28 w-28 items-center justify-center rounded-full bg-white/10">
            <Ionicons color="white" name="people" size={48} />
          </View>
          <Text className="mt-4 font-bold text-base text-white">
            Connected to the room
          </Text>
          <Text className="mt-1 font-medium text-xs text-gray-300">
            Your microphone is {isMicrophoneEnabled ? "on" : "muted"}
          </Text>
        </View>
      )}
      <View className="mt-5 flex-row items-center justify-center gap-5">
        <Pressable
          accessibilityLabel={
            isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"
          }
          className="h-14 w-14 items-center justify-center rounded-full bg-white/15"
          onPress={() => {
            void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
          }}
        >
          <Ionicons
            color="white"
            name={isMicrophoneEnabled ? "mic" : "mic-off"}
            size={22}
          />
        </Pressable>
        {call.type === "video" ? (
          <Pressable
            accessibilityLabel={
              isCameraEnabled ? "Turn camera off" : "Turn camera on"
            }
            className="h-14 w-14 items-center justify-center rounded-full bg-white/15"
            onPress={() => {
              void localParticipant.setCameraEnabled(!isCameraEnabled);
            }}
          >
            <Ionicons
              color="white"
              name={isCameraEnabled ? "videocam" : "videocam-off"}
              size={22}
            />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Leave call"
          className="h-14 w-14 items-center justify-center rounded-full bg-[#c91d20]"
          onPress={onLeave}
        >
          <Ionicons color="white" name="call" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

export function CallProvider({ children }: PropsWithChildren) {
  const token = useAppSelector((state) => state.auth.accessToken);
  const user = useAppSelector((state) => state.auth.user);
  const [directCall, setDirectCall] = useState<DirectCall | null>(null);
  const [groupCall, setGroupCall] = useState<GroupCall | null>(null);
  const [activeGroupCalls, setActiveGroupCalls] = useState<
    Map<string, { type: CallType; startedByName: string }>
  >(new Map());
  const [localStream, setLocalStream] = useState<NativeMediaStream | null>(
    null,
  );
  const [remoteStream, setRemoteStream] = useState<NativeMediaStream | null>(
    null,
  );
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const callRef = useRef<DirectCall | null>(null);
  const groupCallRef = useRef<GroupCall | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<NativeMediaStream | null>(null);
  const offerRef = useRef<NativeSessionDescription | null>(null);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roleCanCall = Boolean(
    user && !user.roles.some((role) => restrictedCallRoles.has(role)),
  );

  useEffect(() => {
    groupCallRef.current = groupCall;
  }, [groupCall]);

  const updateDirect = useCallback((call: DirectCall | null) => {
    callRef.current = call;
    setDirectCall(call);
  }, []);

  const sendSignal = useCallback((signal: Record<string, unknown>) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN)
      throw new Error(
        "Calling service is reconnecting. Try again in a moment.",
      );
    socketRef.current.send(JSON.stringify(signal));
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const releaseDirect = useCallback(() => {
    clearTimer();
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    offerRef.current = null;
    candidateQueueRef.current = [];
    setMuted(false);
    setCameraOff(false);
    updateDirect(null);
    void AudioSession.stopAudioSession().catch(() => undefined);
  }, [clearTimer, updateDirect]);

  const endDirectCall = useCallback(() => {
    const current = callRef.current;
    if (current) {
      try {
        sendSignal({
          type: "call.end",
          callId: current.callId,
          conversationId: current.conversationId,
          targetUserId: current.peerUserId,
          reason: "ended",
        });
      } catch {
        /* Socket may have dropped; local media still needs cleanup. */
      }
    }
    releaseDirect();
  }, [releaseDirect, sendSignal]);

  const makePeer = useCallback(
    async (session: DirectCall) => {
      const iceServers = await chatService.iceServers();
      if (!isCurrentDirectCall(callRef, session.callId)) throw new Error("Call cancelled.");
      peerRef.current?.close();
      const peer = new RTCPeerConnection({
        iceServers,
      });
      peer.addEventListener("icecandidate", ({ candidate }) => {
        if (!candidate || !isCurrentDirectCall(callRef, session.callId)) return;
        try {
          sendSignal({
            type: "call.ice",
            callId: session.callId,
            conversationId: session.conversationId,
            targetUserId: session.peerUserId,
            candidate: candidate.toJSON(),
          });
        } catch {
          /* Reconnection retries the signal channel. */
        }
      });
      peer.addEventListener("track", (event) => {
        if (peerRef.current !== peer) return;
        if (event.track)
          setRemoteStream(
            event.streams[0] ?? new NativeMediaStream([event.track]),
          );
      });
      peer.addEventListener("connectionstatechange", () => {
        if (peerRef.current !== peer) return;
        if (peer.connectionState === "connected") {
          clearTimer();
          const active = callRef.current;
          if (active) updateDirect({ ...active, status: "active" });
        }
        if (
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        )
          releaseDirect();
      });
      peerRef.current = peer;
      return peer;
    },
    [clearTimer, releaseDirect, sendSignal, updateDirect],
  );

  const getMedia = useCallback(
    async (type: CallType) => {
      await AudioSession.startAudioSession();
      return mediaDevices.getUserMedia({
        audio: true,
        video: type === "video" ? { facingMode: "user" } : false,
      });
    },
    [],
  );

  const flushCandidates = useCallback(async (peer: RTCPeerConnection) => {
    for (const candidate of candidateQueueRef.current)
      await peer.addIceCandidate(candidate);
    candidateQueueRef.current = [];
  }, []);

  const acceptDirectCall = useCallback(async () => {
    const call = callRef.current;
    const offer = offerRef.current;
    if (!call || !offer) return;
    clearTimer();
    updateDirect({ ...call, status: "connecting" });
    try {
      const stream = await getMedia(call.type);
      if (!isCurrentDirectCall(callRef, call.callId)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      const peer = await makePeer(call);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(offer);
      await flushCandidates(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      if (!isCurrentDirectCall(callRef, call.callId)) return;
      sendSignal({
        type: "call.answer",
        callId: call.callId,
        conversationId: call.conversationId,
        targetUserId: call.peerUserId,
        sdp: answer,
      });
      timerRef.current = setTimeout(() => endDirectCall(), 30_000);
    } catch (error) {
      if (!isCurrentDirectCall(callRef, call.callId)) return;
      Alert.alert(
        "Call unavailable",
        error instanceof Error ? error.message : "Could not answer call.",
      );
      endDirectCall();
    }
  }, [
    clearTimer,
    endDirectCall,
    flushCandidates,
    getMedia,
    makePeer,
    sendSignal,
    updateDirect,
  ]);

  const declineDirectCall = useCallback(() => {
    const call = callRef.current;
    if (call) {
      try {
        sendSignal({
          type: "call.end",
          callId: call.callId,
          conversationId: call.conversationId,
          targetUserId: call.peerUserId,
          reason: "declined",
        });
      } catch {
        /* Closing locally is still required. */
      }
    }
    releaseDirect();
  }, [releaseDirect, sendSignal]);

  const startDirectCall = useCallback(
    async (input: {
      conversationId: string;
      peerUserId: string;
      peerName: string;
      type: CallType;
    }) => {
      if (!roleCanCall)
        throw new Error("Your role can receive calls but cannot start them.");
      if (callRef.current || groupCall)
        throw new Error("Finish your current call before starting another.");
      const session: DirectCall = {
        kind: "direct",
        callId: `${user?.user_id ?? "user"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        ...input,
        status: "calling",
      };
      updateDirect(session);
      try {
        const stream = await getMedia(input.type);
        if (!isCurrentDirectCall(callRef, session.callId)) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        const peer = await makePeer(session);
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        if (!isCurrentDirectCall(callRef, session.callId)) return;
        sendSignal({
          type: "call.offer",
          callId: session.callId,
          callType: session.type,
          conversationId: session.conversationId,
          targetUserId: session.peerUserId,
          sdp: offer,
        });
        timerRef.current = setTimeout(() => {
          Alert.alert("No answer", "The call was not answered.");
          endDirectCall();
        }, 60_000);
      } catch (error) {
        if (isCurrentDirectCall(callRef, session.callId)) releaseDirect();
        throw error;
      }
    },
    [
      endDirectCall,
      getMedia,
      groupCall,
      makePeer,
      releaseDirect,
      roleCanCall,
      sendSignal,
      updateDirect,
      user?.user_id,
    ],
  );

  useEffect(() => {
    if (!token || !user) return;
    let closed = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      const socket = new WebSocket(chatService.webSocketUrl(token));
      socketRef.current = socket;
      socket.onopen = () => {
        retry = 0;
      };
      socket.onmessage = (event) => {
        let packet: CallSignal;
        try {
          packet = JSON.parse(event.data) as CallSignal;
        } catch {
          return;
        }
        if (
          packet.type === "call.offer" &&
          packet.callId &&
          packet.callType &&
          packet.conversationId &&
          packet.userId &&
          packet.sdp
        ) {
          if (callRef.current || groupCallRef.current) {
            try {
              socket.send(
                JSON.stringify({
                  type: "call.end",
                  callId: packet.callId,
                  conversationId: packet.conversationId,
                  targetUserId: packet.userId,
                  reason: "busy",
                }),
              );
            } catch {
              /* Socket may already be closing. */
            }
            return;
          }
          offerRef.current = packet.sdp;
          updateDirect({
            kind: "direct",
            callId: packet.callId,
            conversationId: packet.conversationId,
            peerUserId: packet.userId,
            peerName: packet.callerName ?? "Ricoz contact",
            type: packet.callType,
            status: "incoming",
          });
          timerRef.current = setTimeout(() => declineDirectCall(), 60_000);
        }
        if (
          packet.type === "call.answer" &&
          packet.callId === callRef.current?.callId &&
          packet.sdp
        ) {
          clearTimer();
          updateDirect({ ...callRef.current!, status: "connecting" });
          void peerRef.current
            ?.setRemoteDescription(packet.sdp)
            .then(() =>
              peerRef.current ? flushCandidates(peerRef.current) : undefined,
            )
            .catch(() => endDirectCall());
          timerRef.current = setTimeout(() => endDirectCall(), 30_000);
        }
        if (
          packet.type === "call.ice" &&
          packet.callId === callRef.current?.callId &&
          packet.candidate
        ) {
          if (peerRef.current?.remoteDescription)
            void peerRef.current.addIceCandidate(packet.candidate).catch(() => endDirectCall());
          else candidateQueueRef.current.push(packet.candidate);
        }
        if (
          packet.type === "call.end" &&
          packet.callId === callRef.current?.callId
        ) {
          if (packet.reason === "declined")
            Alert.alert(
              "Call declined",
              `${callRef.current?.peerName ?? "Contact"} declined the call.`,
            );
          releaseDirect();
        }
        if (
          packet.type === "call.error" &&
          (!packet.callId || packet.callId === callRef.current?.callId)
        ) {
          Alert.alert(
            "Call",
            packet.message ?? "The call could not be connected.",
          );
          releaseDirect();
        }
        if (packet.type === "call.livekit.started" && packet.conversationId) {
          setActiveGroupCalls((current) =>
            new Map(current).set(packet.conversationId!, {
              type: packet.callType ?? "video",
              startedByName: packet.startedByName ?? "A team member",
            }),
          );
        }
        if (packet.type === "call.livekit.ended" && packet.conversationId) {
          setActiveGroupCalls((current) => {
            const next = new Map(current);
            next.delete(packet.conversationId!);
            return next;
          });
          if (groupCallRef.current?.conversationId === packet.conversationId)
            setGroupCall(null);
        }
      };
      socket.onclose = () => {
        if (callRef.current) releaseDirect();
        if (!closed)
          reconnectTimer = setTimeout(
            connect,
            Math.min(30_000, 1000 * 2 ** retry++),
          );
      };
    };
    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
      releaseDirect();
      setGroupCall(null);
      setActiveGroupCalls(new Map());
    };
  }, [
    token,
    user,
    clearTimer,
    declineDirectCall,
    endDirectCall,
    flushCandidates,
    releaseDirect,
    updateDirect,
  ]);

  const startGroupCall = useCallback(
    async (input: {
      conversationId: string;
      conversationName: string;
      type: CallType;
    }) => {
      if (directCall || groupCall)
        throw new Error("Finish your current call before starting another.");
      const info = await chatService.startGroupCall(
        input.conversationId,
        input.type,
      );
      setGroupCall({
        kind: "group",
        conversationId: input.conversationId,
        conversationName: input.conversationName,
        ...info,
      });
    },
    [directCall, groupCall],
  );

  const joinGroupCall = useCallback(
    async (input: { conversationId: string; conversationName: string }) => {
      if (directCall || groupCall)
        throw new Error("Finish your current call before joining another.");
      const info = await chatService.joinGroupCall(input.conversationId);
      setGroupCall({
        kind: "group",
        conversationId: input.conversationId,
        conversationName: input.conversationName,
        ...info,
      });
    },
    [directCall, groupCall],
  );

  const endGroupCall = useCallback(async () => {
    const current = groupCall;
    setGroupCall(null);
    if (current?.isAdmin) {
      try {
        await chatService.endGroupCall(current.conversationId);
      } catch (error) {
        Alert.alert(
          "Call",
          error instanceof Error
            ? error.message
            : "Unable to end the group call.",
        );
      }
    }
  }, [groupCall]);

  const syncActiveGroupCall = useCallback(
    (
      conversationId: string,
      call: { type: CallType; startedByName: string } | null,
    ) => {
      setActiveGroupCalls((current) => {
        const next = new Map(current);
        if (call) next.set(conversationId, call);
        else next.delete(conversationId);
        return next;
      });
    },
    [],
  );

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    setCameraOff(next);
  };

  return (
    <CallContext.Provider
      value={{
        callsSupported: true,
        directCall,
        groupCall,
        activeGroupCalls,
        syncActiveGroupCall,
        startDirectCall,
        acceptDirectCall,
        declineDirectCall,
        endDirectCall,
        startGroupCall,
        joinGroupCall,
        endGroupCall,
      }}
    >
      {children}
      {directCall ? (
        <Modal
          animationType="fade"
          onRequestClose={
            directCall.status === "incoming" ? declineDirectCall : endDirectCall
          }
          visible
          transparent
        >
          <View className="flex-1 items-center justify-center bg-[#101a2c]/80 p-5">
            <View className="w-full max-w-md items-center rounded-2xl bg-[#18243a] px-6 py-8">
              {directCall.type === "video" &&
              directCall.status !== "incoming" &&
              remoteStream ? (
                <RTCView
                  style={{
                    width: "100%",
                    height: 256,
                    marginBottom: 24,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                  objectFit="cover"
                  streamURL={remoteStream.toURL()}
                />
              ) : (
                <View className="mb-5 h-24 w-24 items-center justify-center rounded-full bg-white/10">
                  <Ionicons
                    color="white"
                    name={directCall.type === "video" ? "videocam" : "person"}
                    size={42}
                  />
                </View>
              )}
              <Text className="font-extra text-xl text-white">
                {directCall.peerName}
              </Text>
              <Text className="mt-2 font-medium text-sm text-gray-300">
                {directCall.status === "incoming"
                  ? `Incoming ${directCall.type} call`
                  : directCall.status === "calling"
                    ? "Calling…"
                    : directCall.status === "connecting"
                      ? "Connecting…"
                      : "Connected"}
              </Text>
              {directCall.type === "video" &&
              directCall.status !== "incoming" &&
              localStream ? (
                <RTCView
                  style={{
                    position: "absolute",
                    right: 28,
                    top: 28,
                    width: 96,
                    height: 128,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                  mirror
                  objectFit="cover"
                  streamURL={localStream.toURL()}
                />
              ) : null}
              <View className="mt-8 flex-row items-center gap-5">
                {directCall.status === "incoming" ? (
                  <>
                    <Pressable
                      accessibilityLabel="Decline call"
                      className="h-14 w-14 items-center justify-center rounded-full bg-[#c91d20]"
                      onPress={declineDirectCall}
                    >
                      <Ionicons color="white" name="call" size={22} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Accept call"
                      className="h-14 w-14 items-center justify-center rounded-full bg-[#16a34a]"
                      onPress={() => {
                        void acceptDirectCall();
                      }}
                    >
                      <Ionicons color="white" name="call" size={22} />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      accessibilityLabel={muted ? "Unmute" : "Mute"}
                      className="h-12 w-12 items-center justify-center rounded-full bg-white/15"
                      onPress={toggleMute}
                    >
                      <Ionicons
                        color="white"
                        name={muted ? "mic-off" : "mic"}
                        size={21}
                      />
                    </Pressable>
                    {directCall.type === "video" ? (
                      <Pressable
                        accessibilityLabel={
                          cameraOff ? "Turn camera on" : "Turn camera off"
                        }
                        className="h-12 w-12 items-center justify-center rounded-full bg-white/15"
                        onPress={toggleCamera}
                      >
                        <Ionicons
                          color="white"
                          name={cameraOff ? "videocam-off" : "videocam"}
                          size={21}
                        />
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityLabel="End call"
                      className="h-14 w-14 items-center justify-center rounded-full bg-[#c91d20]"
                      onPress={endDirectCall}
                    >
                      <Ionicons color="white" name="call" size={22} />
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
      {groupCall ? (
        <Modal
          animationType="slide"
          onRequestClose={() => {
            void endGroupCall();
          }}
          visible
        >
          <GroupRoom
            call={groupCall}
            onLeave={() => {
              void endGroupCall();
            }}
          />
        </Modal>
      ) : null}
    </CallContext.Provider>
  );
}
