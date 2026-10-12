"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Participant,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import { toast } from "sonner";
import { useAppSelector } from "@/redux/hooks";
import { ChatService, chatWebSocketUrl } from "@/services/chat.service";
import {
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";

type CallType = "audio" | "video";

type GroupCallInvite = {
  conversationId: string;
  conversationName: string;
  type: CallType;
  startedByName: string;
};

type JoinedGroupCall = {
  conversationId: string;
  conversationName: string;
  type: CallType;
  isAdmin: boolean;
  joinedAt: number;
};

type GroupCallContextValue = {
  activeCalls: Map<string, GroupCallInvite>;
  joinedCall: JoinedGroupCall | null;
  startGroupCall: (input: {
    conversationId: string;
    conversationName: string;
    type: CallType;
  }) => Promise<void>;
  joinGroupCall: (input: {
    conversationId: string;
    conversationName: string;
  }) => Promise<void>;
  syncActiveCall: (
    conversationId: string,
    conversationName: string,
    call: { type: CallType; startedByName: string } | null,
  ) => void;
};

const GroupCallContext = createContext<GroupCallContextValue | null>(null);
const avatarPalette = ["#1a73e8", "#d93025", "#f9ab00", "#188038", "#8430ce", "#12847c"];

function avatarColor(identity: string) {
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1)
    hash = (hash * 31 + identity.charCodeAt(index)) | 0;
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const parts = hours ? [hours, minutes % 60, seconds % 60] : [minutes, seconds % 60];
  return parts.map((part) => String(part).padStart(2, "0")).join(":");
}

export function useGroupCall() {
  const context = useContext(GroupCallContext);
  if (!context)
    throw new Error("useGroupCall must be used within GroupCallProvider");
  return context;
}

export function GroupCallProvider({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.access_token);
  const userId = useAppSelector((state) => state.auth.user?.user_id);
  const [activeCalls, setActiveCalls] = useState<Map<string, GroupCallInvite>>(
    new Map(),
  );
  const [joinedCall, setJoinedCall] = useState<JoinedGroupCall | null>(null);
  const [dismissedCalls, setDismissedCalls] = useState<Set<string>>(new Set());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
  const [showParticipants, setShowParticipants] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const roomRef = useRef<Room | null>(null);
  const overlayRef = useRef<HTMLElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panelX: number;
    panelY: number;
  } | null>(null);

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    setParticipants([room.localParticipant, ...room.remoteParticipants.values()]);
  }, []);

  const leaveGroupCall = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setJoinedCall(null);
    setParticipants([]);
    setSpeakingIds(new Set());
    setShowParticipants(false);
    setMuted(false);
    setCameraOff(false);
    setScreenSharing(false);
    setConnecting(false);
    setAudioPlaybackBlocked(false);
    setDragPosition(null);
  }, []);

  const connectToRoom = useCallback(
    async (
      info: { token: string; url: string; type: CallType; isAdmin: boolean },
      conversationId: string,
      conversationName: string,
    ) => {
      const room = new Room({ audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(RoomEvent.ParticipantConnected, refreshParticipants);
      room.on(RoomEvent.ParticipantDisconnected, refreshParticipants);
      room.on(RoomEvent.TrackSubscribed, refreshParticipants);
      room.on(RoomEvent.TrackUnsubscribed, refreshParticipants);
      room.on(RoomEvent.TrackMuted, refreshParticipants);
      room.on(RoomEvent.TrackUnmuted, refreshParticipants);
      room.on(RoomEvent.AudioPlaybackStatusChanged, (canPlaybackAudio) =>
        setAudioPlaybackBlocked(!canPlaybackAudio),
      );
      room.on(RoomEvent.LocalTrackPublished, refreshParticipants);
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) setScreenSharing(false);
        refreshParticipants();
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) =>
        setSpeakingIds(new Set(speakers.map((speaker) => speaker.identity))),
      );
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) leaveGroupCall();
      });
      try {
        await room.connect(info.url, info.token);
        setAudioPlaybackBlocked(!room.canPlaybackAudio);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (info.type === "video") await room.localParticipant.setCameraEnabled(true);
        setJoinedCall({
          conversationId,
          conversationName,
          type: info.type,
          isAdmin: info.isAdmin,
          joinedAt: Date.now(),
        });
        setDismissedCalls((current) => {
          const next = new Set(current);
          next.delete(conversationId);
          return next;
        });
        refreshParticipants();
      } catch (error) {
        room.disconnect();
        roomRef.current = null;
        toast.error(
          error instanceof Error ? error.message : "Could not join the call",
        );
      } finally {
        setConnecting(false);
      }
    },
    [leaveGroupCall, refreshParticipants],
  );

  const startGroupCall = useCallback(
    async (input: { conversationId: string; conversationName: string; type: CallType }) => {
      if (roomRef.current) {
        toast.error("Leave your current call before starting another");
        return;
      }
      setConnecting(true);
      setExpanded(true);
      try {
        const info = await ChatService.startGroupCall(input.conversationId, input.type);
        await connectToRoom(info, input.conversationId, input.conversationName);
      } catch (error) {
        setConnecting(false);
        toast.error(
          error instanceof Error ? error.message : "Could not start the call",
        );
      }
    },
    [connectToRoom],
  );

  const joinGroupCall = useCallback(
    async (input: { conversationId: string; conversationName: string }) => {
      if (roomRef.current) {
        toast.error("Leave your current call before joining another");
        return;
      }
      setConnecting(true);
      setExpanded(true);
      try {
        const info = await ChatService.joinGroupCall(input.conversationId);
        await connectToRoom(info, input.conversationId, input.conversationName);
      } catch (error) {
        setConnecting(false);
        toast.error(
          error instanceof Error ? error.message : "Could not join the call",
        );
      }
    },
    [connectToRoom],
  );

  const endGroupCallForEveryone = useCallback(async () => {
    if (!joinedCall) return;
    try {
      await ChatService.endGroupCall(joinedCall.conversationId);
    } finally {
      leaveGroupCall();
    }
  }, [joinedCall, leaveGroupCall]);

  const syncActiveCall = useCallback(
    (
      conversationId: string,
      conversationName: string,
      call: { type: CallType; startedByName: string } | null,
    ) => {
      setActiveCalls((current) => {
        const next = new Map(current);
        if (call) next.set(conversationId, { conversationId, conversationName, ...call });
        else next.delete(conversationId);
        return next;
      });
    },
    [],
  );

  const toggleMute = () => {
    const next = !muted;
    void roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };
  const enableGroupAudio = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setAudioPlaybackBlocked(false);
    } catch {
      setAudioPlaybackBlocked(true);
      toast.error("Your browser blocked call audio. Allow audio playback and try again.");
    }
  };
  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOff;
    try {
      await room.localParticipant.setCameraEnabled(!next);
    } catch {
      // Some browsers fail to swap an existing camera sender; republish instead.
      try {
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.setCameraEnabled(true);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not switch the camera",
        );
      }
    } finally {
      const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
      setCameraOff(!publication?.track || publication.isMuted);
    }
  };
  const toggleScreenShare = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !screenSharing;
    try {
      await room.localParticipant.setScreenShareEnabled(next, { audio: true });
      setScreenSharing(next);
    } catch {
      // The browser's share picker was dismissed without a selection.
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (expanded || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const panel = overlayRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panelX: rect.left,
      panelY: rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = overlayRef.current;
    if (!drag || !panel || drag.pointerId !== event.pointerId) return;
    const padding = 8;
    setDragPosition({
      x: Math.min(
        window.innerWidth - panel.offsetWidth - padding,
        Math.max(padding, drag.panelX + event.clientX - drag.startX),
      ),
      y: Math.min(
        window.innerHeight - panel.offsetHeight - padding,
        Math.max(padding, drag.panelY + event.clientY - drag.startY),
      ),
    });
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!token || !userId) return;
    let closed = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const socket = new WebSocket(chatWebSocketUrl(token));
      socketRef.current = socket;
      socket.onopen = () => {
        retry = 0;
      };
      socket.onmessage = (event) => {
        const packet = JSON.parse(event.data) as {
          type: string;
          conversationId?: string;
          conversationName?: string;
          startedByName?: string;
          callType?: CallType;
        };
        if (packet.type === "call.livekit.started" && packet.conversationId) {
          setActiveCalls((current) => {
            const next = new Map(current);
            next.set(packet.conversationId!, {
              conversationId: packet.conversationId!,
              conversationName: packet.conversationName ?? "Group call",
              type: packet.callType ?? "video",
              startedByName: packet.startedByName ?? "A team member",
            });
            return next;
          });
        }
        if (packet.type === "call.livekit.ended" && packet.conversationId) {
          setActiveCalls((current) => {
            if (!current.has(packet.conversationId!)) return current;
            const next = new Map(current);
            next.delete(packet.conversationId!);
            return next;
          });
          if (joinedCall?.conversationId === packet.conversationId) leaveGroupCall();
        }
      };
      socket.onclose = () => {
        if (!closed)
          reconnectTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
      };
    };
    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  useEffect(
    () => () => {
      void roomRef.current?.disconnect();
    },
    [],
  );

  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (!joinedCall) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [joinedCall]);

  const invite = !joinedCall
    ? [...activeCalls.values()].find((call) => !dismissedCalls.has(call.conversationId))
    : undefined;

  return (
    <GroupCallContext.Provider
      value={{ activeCalls, joinedCall, startGroupCall, joinGroupCall, syncActiveCall }}
    >
      {children}
      {invite ? (
        <div className="fixed inset-x-0 top-0 z-100 flex justify-center p-3">
          <div className="flex items-center gap-3 rounded-md bg-[#18243a] px-4 py-2.5 text-sm text-white shadow-xl">
            {invite.type === "video" ? <Video size={16} /> : <Phone size={16} />}
            <span>
              <strong>{invite.startedByName}</strong> started a call in{" "}
              <strong>{invite.conversationName}</strong>
            </span>
            <button
              type="button"
              onClick={() =>
                void joinGroupCall({
                  conversationId: invite.conversationId,
                  conversationName: invite.conversationName,
                })
              }
              className="rounded-sm bg-[#16a34a] px-3 py-1 text-xs font-bold hover:bg-[#128a3d]"
            >
              Join
            </button>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() =>
                setDismissedCalls((current) => new Set(current).add(invite.conversationId))
              }
              className="flex h-6 w-6 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}
      {connecting && !joinedCall ? (
        <div className="fixed bottom-6 right-6 z-100 rounded-md bg-[#18243a] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          Connecting to call...
        </div>
      ) : null}
      {joinedCall ? (
        <section
          ref={overlayRef}
          className={`fixed z-100 overflow-hidden bg-[#202124] text-white shadow-2xl transition-[width,height,border-radius] duration-300 ${
            expanded
              ? "inset-0"
              : `${dragPosition ? "" : "bottom-4 right-4"} h-[30vh] min-h-60 w-[calc(100vw-2rem)] rounded-md border border-white/10 sm:w-[30vw] sm:min-w-80 sm:max-w-120`
          }`}
          style={
            !expanded && dragPosition
              ? { left: dragPosition.x, top: dragPosition.y }
              : undefined
          }
          role="dialog"
          aria-modal={expanded}
          aria-label={`Group call in ${joinedCall.conversationName}`}
        >
          <div className="relative flex h-full flex-col">
            <div
              className="grid flex-1 gap-1.5 overflow-y-auto bg-[#202124] p-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, Math.ceil(Math.sqrt(participants.length || 1))))}, minmax(0, 1fr))`,
              }}
            >
              {participants.map((participant) => (
                <ParticipantTile
                  key={participant.identity}
                  participant={participant}
                  speaking={speakingIds.has(participant.identity)}
                />
              ))}
            </div>

            <header
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              className={`absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4 ${expanded ? "" : "cursor-grab touch-none active:cursor-grabbing"}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{joinedCall.conversationName}</p>
                <p className="text-xs text-white/70">
                  {formatDuration(Math.max(0, Math.floor((clock - joinedCall.joinedAt) / 1000)))}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={showParticipants ? "Hide participants" : "Show participants"}
                  onClick={() => setShowParticipants((current) => !current)}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold hover:bg-white/20 ${showParticipants ? "bg-white/25" : "bg-white/10"}`}
                >
                  <Users size={15} /> {participants.length}
                </button>
                <button
                  type="button"
                  aria-label={expanded ? "Minimize call" : "Full screen"}
                  onClick={() => setExpanded((current) => !current)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
              </div>
            </header>

            {screenSharing ? (
              <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-full bg-[#1a73e8] px-4 py-1.5 text-xs font-semibold shadow-lg">
                You are presenting to everyone
              </div>
            ) : null}

            <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-4">
              {audioPlaybackBlocked ? (
                <button
                  type="button"
                  onClick={() => void enableGroupAudio()}
                  aria-label="Enable call audio"
                  title="Enable call audio"
                  className="flex h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-[#202124] hover:bg-white/90"
                >
                  <Volume2 size={18} /> Enable audio
                </button>
              ) : null}
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className={`flex h-12 w-12 items-center justify-center rounded-full hover:bg-white/20 ${muted ? "bg-white text-[#202124]" : "bg-[#3c4043]"}`}
              >
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              {joinedCall.type === "video" ? (
                <button
                  type="button"
                  onClick={() => void toggleCamera()}
                  aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                  className={`flex h-12 w-12 items-center justify-center rounded-full hover:bg-white/20 ${cameraOff ? "bg-white text-[#202124]" : "bg-[#3c4043]"}`}
                >
                  {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void toggleScreenShare()}
                aria-label={screenSharing ? "Stop sharing screen" : "Share screen"}
                title={screenSharing ? "Stop sharing screen" : "Share screen"}
                className={`flex h-12 w-12 items-center justify-center rounded-full hover:bg-white/20 ${screenSharing ? "bg-[#1a73e8]" : "bg-[#3c4043]"}`}
              >
                {screenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
              </button>
              <button
                type="button"
                onClick={leaveGroupCall}
                aria-label="Leave call"
                className="flex h-12 w-14 items-center justify-center rounded-full bg-[#ea4335] hover:bg-[#d33426]"
              >
                <PhoneOff size={20} />
              </button>
              {joinedCall.isAdmin ? (
                <button
                  type="button"
                  onClick={() => void endGroupCallForEveryone()}
                  title="End for everyone"
                  className="h-12 rounded-full bg-[#3c4043] px-4 text-xs font-bold hover:bg-white/20"
                >
                  End for everyone
                </button>
              ) : null}
            </div>

            {showParticipants ? (
              <aside className="absolute inset-y-0 right-0 z-20 w-64 overflow-y-auto border-l border-white/10 bg-[#282a2c] p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/60">
                  In this call ({participants.length})
                </p>
                <div className="space-y-1">
                  {participants.map((participant) => {
                    const micOn =
                      Boolean(participant.getTrackPublication(Track.Source.Microphone)?.track) &&
                      !participant.getTrackPublication(Track.Source.Microphone)?.isMuted;
                    return (
                      <div key={participant.identity} className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-white/5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{ backgroundColor: avatarColor(participant.identity) }}
                        >
                          {(participant.name ?? "?").slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {participant.isLocal ? "You" : participant.name}
                        </span>
                        {micOn ? <Mic size={14} className="text-white/50" /> : <MicOff size={14} className="text-[#ea4335]" />}
                      </div>
                    );
                  })}
                </div>
              </aside>
            ) : null}
          </div>
        </section>
      ) : null}
    </GroupCallContext.Provider>
  );
}


function ParticipantTile({
  participant,
  speaking,
}: {
  participant: Participant;
  speaking: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const attachedRef = useRef<{ video?: Track; audio?: Track; screenAudio?: Track }>({});

  // Reattach only the tracks that actually changed so unrelated re-renders (the call clock,
  // active-speaker highlight) don't recreate the <video> element and cause flicker.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const attached = attachedRef.current;

    const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);
    const videoPublication = participant.getTrackPublication(Track.Source.Camera);
    const activeCameraTrack =
      videoPublication?.track && !videoPublication.isMuted ? videoPublication.track : undefined;
    const nextVideo = screenPublication?.track ?? activeCameraTrack;
    if (attached.video !== nextVideo) {
      attached.video?.detach().forEach((element) => element.remove());
      if (nextVideo) {
        const element = nextVideo.attach();
        const mirror = participant.isLocal && !screenPublication?.track;
        element.className = `h-full w-full ${screenPublication?.track ? "object-contain" : "object-cover"} ${mirror ? "scale-x-[-1]" : ""}`;
        container.appendChild(element);
      }
      attached.video = nextVideo;
    }

    const nextAudio = !participant.isLocal
      ? participant.getTrackPublication(Track.Source.Microphone)?.track
      : undefined;
    if (attached.audio !== nextAudio) {
      attached.audio?.detach().forEach((element) => element.remove());
      if (nextAudio) container.appendChild(nextAudio.attach());
      attached.audio = nextAudio;
    }

    const nextScreenAudio = !participant.isLocal
      ? participant.getTrackPublication(Track.Source.ScreenShareAudio)?.track
      : undefined;
    if (attached.screenAudio !== nextScreenAudio) {
      attached.screenAudio?.detach().forEach((element) => element.remove());
      if (nextScreenAudio) container.appendChild(nextScreenAudio.attach());
      attached.screenAudio = nextScreenAudio;
    }
  });

  useEffect(
    () => () => {
      const attached = attachedRef.current;
      attached.video?.detach().forEach((element) => element.remove());
      attached.audio?.detach().forEach((element) => element.remove());
      attached.screenAudio?.detach().forEach((element) => element.remove());
    },
    [],
  );

  const isPresenting = Boolean(participant.getTrackPublication(Track.Source.ScreenShare)?.track);
  const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
  const hasVideo =
    isPresenting || Boolean(cameraPublication?.track && !cameraPublication.isMuted);
  const micOn =
    Boolean(participant.getTrackPublication(Track.Source.Microphone)?.track) &&
    !participant.getTrackPublication(Track.Source.Microphone)?.isMuted;

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-[#3c4043] transition-shadow ${speaking && !isPresenting ? "ring-4 ring-[#8ab4f8]" : ""}`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {!hasVideo ? (
        <span
          className="absolute flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold sm:h-24 sm:w-24"
          style={{ backgroundColor: avatarColor(participant.identity) }}
        >
          {(participant.name ?? "?").slice(0, 2).toUpperCase()}
        </span>
      ) : null}
      {isPresenting ? (
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[#1a73e8] px-2 py-0.5 text-[10px] font-bold">
          <ScreenShare size={11} /> Presenting
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium">
        {!micOn ? <MicOff size={12} className="text-[#ea4335]" /> : null}
        {participant.isLocal ? "You" : participant.name}
      </span>
    </div>
  );
}

