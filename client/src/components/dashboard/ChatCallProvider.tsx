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
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneOff,
  Volume2,
  Video,
  VideoOff,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { chatWebSocketUrl } from "@/services/chat.service";
import { USER_ROLES } from "@/lib/auth/roles";
import { startIncomingCallRingtone } from "@/lib/chat/notificationSound";

type CallType = "audio" | "video";
type CallStatus = "incoming" | "calling" | "connecting" | "active";

type CallSession = {
  callId: string;
  conversationId: string;
  peerUserId: string;
  peerName: string;
  type: CallType;
  status: CallStatus;
  startedAt: number | null;
};

type StoredCallSession = CallSession & { savedAt: number };

type CallSignal = {
  type: string;
  callId?: string;
  callType?: CallType;
  conversationId?: string;
  targetUserId?: string;
  userId?: string;
  callerName?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  message?: string;
};

type StartCallInput = {
  conversationId: string;
  peerUserId: string;
  peerName: string;
  type: CallType;
};

type ChatCallContextValue = {
  canStartCall: boolean;
  call: CallSession | null;
  startCall: (input: StartCallInput) => Promise<void>;
};

const ChatCallContext = createContext<ChatCallContextValue | null>(null);
const restrictedCallers = new Set<string>([
  USER_ROLES.INTERN,
  USER_ROLES.EMPLOYEE,
]);
const callStorageKey = (userId: string) => `ricoz:active-call:${userId}`;
const maxStoredCallAge = 12 * 60 * 60 * 1000;
const unansweredCallTimeoutMs = 60_000;

function readStoredCall(userId: string): CallSession | null {
  const storageKey = callStorageKey(userId);
  const stored = sessionStorage.getItem(storageKey);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored) as StoredCallSession;
    if (Date.now() - session.savedAt > maxStoredCallAge) {
      sessionStorage.removeItem(storageKey);
      return null;
    }
    const { savedAt, ...call } = session;
    void savedAt;
    return call;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl)
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  return servers;
}

export function useChatCall() {
  const context = useContext(ChatCallContext);
  if (!context)
    throw new Error("useChatCall must be used within ChatCallProvider");
  return context;
}

export function ChatCallProvider({ children }: { children: ReactNode }) {
  const token = useAppSelector((state) => state.auth.access_token);
  const user = useAppSelector((state) => state.auth.user);
  const [call, setCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const callRef = useRef<CallSession | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const incomingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const ringtoneStopRef = useRef<(() => void) | null>(null);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringRef = useRef(false);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const canStartCall = Boolean(
    user && !user.roles.some((role) => restrictedCallers.has(role)),
  );

  const updateCall = useCallback((next: CallSession | null) => {
    callRef.current = next;
    setCall(next);
    if (!user) return;
    const storageKey = callStorageKey(user.user_id);
    if (next && ["connecting", "active"].includes(next.status))
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ ...next, savedAt: Date.now() } satisfies StoredCallSession),
      );
    else sessionStorage.removeItem(storageKey);
  }, [user]);

  const sendSignal = useCallback((signal: CallSignal) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN)
      throw new Error("Calling service is reconnecting");
    socketRef.current.send(JSON.stringify(signal));
  }, []);

  const stopRingtone = useCallback(() => {
    ringtoneStopRef.current?.();
    ringtoneStopRef.current = null;
  }, []);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = null;
  }, []);

  const releaseCall = useCallback((preserveStoredCall = false) => {
    stopRingtone();
    clearCallTimeout();
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setAudioPlaybackBlocked(false);
    incomingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setMuted(false);
    setCameraOff(false);
    restoringRef.current = false;
    callRef.current = null;
    setCall(null);
    if (!preserveStoredCall && user)
      sessionStorage.removeItem(callStorageKey(user.user_id));
  }, [clearCallTimeout, stopRingtone, user]);

  const endCall = useCallback(
    (reason = "ended") => {
      const current = callRef.current;
      if (current && socketRef.current?.readyState === WebSocket.OPEN)
        sendSignal({
          type: "call.end",
          callId: current.callId,
          conversationId: current.conversationId,
          targetUserId: current.peerUserId,
          reason,
        });
      if (reason === "ended" || reason === "declined") setError(null);
      releaseCall();
    },
    [releaseCall, sendSignal],
  );

  const createPeer = useCallback(
    (session: CallSession) => {
      peerRef.current?.close();
      const peer = new RTCPeerConnection({ iceServers: iceServers() });
      peer.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        try {
          sendSignal({
            type: "call.ice",
            callId: session.callId,
            conversationId: session.conversationId,
            targetUserId: session.peerUserId,
            candidate: candidate.toJSON(),
          });
        } catch {
          setError("Calling service disconnected");
        }
      };
      peer.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        setRemoteStream(stream);
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") {
          clearCallTimeout();
          const current = callRef.current;
          if (current)
            updateCall({
              ...current,
              status: "active",
              startedAt: current.startedAt ?? Date.now(),
            });
        }
        if (peer.connectionState === "failed") releaseCall();
      };
      peerRef.current = peer;
      return peer;
    },
    [clearCallTimeout, releaseCall, sendSignal, updateCall],
  );

  const getMedia = useCallback(async (type: CallType) => {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("Camera and microphone require a secure browser context");
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      video: type === "video" ? { facingMode: "user" } : false,
    });
  }, []);

  const restoreCall = useCallback(async () => {
    if (!user || restoringRef.current || callRef.current) return;
    const stored = readStoredCall(user.user_id);
    if (!stored) return;
    restoringRef.current = true;
    const restored: CallSession = { ...stored, status: "connecting" };
    updateCall(restored);
    setError(null);
    try {
      const stream = await getMedia(restored.type);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const peer = createPeer(restored);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      callTimeoutRef.current = setTimeout(() => {
        setError("Call could not resume");
        endCall("resume-failed");
      }, 30_000);
      sendSignal({
        type: "call.resume",
        callId: restored.callId,
        callType: restored.type,
        conversationId: restored.conversationId,
        targetUserId: restored.peerUserId,
      });
    } catch (callError) {
      setError(
        callError instanceof Error ? callError.message : "Could not resume call",
      );
      releaseCall();
    }
  }, [createPeer, endCall, getMedia, releaseCall, sendSignal, updateCall, user]);

  const startCall = useCallback(
    async (input: StartCallInput) => {
      if (!canStartCall) {
        setError("Your role can receive calls but cannot start them");
        return;
      }
      if (callRef.current) return;
      const session: CallSession = {
        callId: crypto.randomUUID(),
        conversationId: input.conversationId,
        peerUserId: input.peerUserId,
        peerName: input.peerName,
        type: input.type,
        status: "calling",
        startedAt: null,
      };
      updateCall(session);
      setError(null);
      callTimeoutRef.current = setTimeout(() => {
        setError("No answer");
        endCall("unanswered");
      }, unansweredCallTimeoutMs);
      try {
        const stream = await getMedia(input.type);
        localStreamRef.current = stream;
        setLocalStream(stream);
        const peer = createPeer(session);
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        sendSignal({
          type: "call.offer",
          callId: session.callId,
          callType: input.type,
          conversationId: input.conversationId,
          targetUserId: input.peerUserId,
          sdp: offer,
        });
      } catch (callError) {
        setError(
          callError instanceof Error ? callError.message : "Could not start call",
        );
        releaseCall();
      }
    },
    [
      canStartCall,
      createPeer,
      endCall,
      getMedia,
      releaseCall,
      sendSignal,
      updateCall,
    ],
  );

  const acceptCall = useCallback(async () => {
    const session = callRef.current;
    const offer = incomingOfferRef.current;
    if (!session || !offer) return;
    stopRingtone();
    clearCallTimeout();
    callTimeoutRef.current = setTimeout(() => {
      setError("Call could not connect");
      endCall("connection-failed");
    }, 30_000);
    setError(null);
    updateCall({ ...session, status: "connecting" });
    try {
      const stream = await getMedia(session.type);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const peer = createPeer(session);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await peer.setRemoteDescription(offer);
      for (const candidate of pendingCandidatesRef.current)
        await peer.addIceCandidate(candidate);
      pendingCandidatesRef.current = [];
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal({
        type: "call.answer",
        callId: session.callId,
        conversationId: session.conversationId,
        targetUserId: session.peerUserId,
        sdp: answer,
      });
    } catch (callError) {
      setError(
        callError instanceof Error ? callError.message : "Could not answer call",
      );
      endCall("media-unavailable");
    }
  }, [clearCallTimeout, createPeer, endCall, getMedia, sendSignal, stopRingtone, updateCall]);

  useEffect(() => {
    if (!token || !user) return;
    let closed = false;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const socket = new WebSocket(chatWebSocketUrl(token));
      socketRef.current = socket;
      socket.onopen = () => {
        retry = 0;
        void restoreCall();
      };
      socket.onmessage = (event) => {
        const packet = JSON.parse(event.data) as CallSignal;
        if (!packet.type.startsWith("call.")) return;

        if (
          packet.type === "call.offer" &&
          packet.callId &&
          packet.callType &&
          packet.conversationId &&
          packet.userId &&
          packet.sdp
        ) {
          if (callRef.current) {
            socket.send(
              JSON.stringify({
                type: "call.end",
                callId: packet.callId,
                conversationId: packet.conversationId,
                targetUserId: packet.userId,
                reason: "busy",
              }),
            );
            return;
          }
          incomingOfferRef.current = packet.sdp;
          const incoming: CallSession = {
            callId: packet.callId,
            conversationId: packet.conversationId,
            peerUserId: packet.userId,
            peerName: packet.callerName ?? "Ricoz contact",
            type: packet.callType,
            status: "incoming",
            startedAt: null,
          };
          setError(null);
          updateCall(incoming);
          ringtoneStopRef.current = startIncomingCallRingtone();
          callTimeoutRef.current = setTimeout(() => {
            const current = callRef.current;
            if (current?.callId === incoming.callId) endCall("unanswered");
          }, unansweredCallTimeoutMs);
        }
        if (
          packet.type === "call.answer" &&
          packet.callId === callRef.current?.callId &&
          packet.sdp
        ) {
          clearCallTimeout();
          callTimeoutRef.current = setTimeout(() => {
            setError("Call could not connect");
            endCall("connection-failed");
          }, 30_000);
          const current = callRef.current;
          if (current) updateCall({ ...current, status: "connecting" });
          void peerRef.current?.setRemoteDescription(packet.sdp).then(async () => {
            const peer = peerRef.current;
            if (peer)
              for (const candidate of pendingCandidatesRef.current)
                await peer.addIceCandidate(candidate);
            pendingCandidatesRef.current = [];
          });
        }
        if (
          packet.type === "call.resume" &&
          packet.callId === callRef.current?.callId &&
          packet.userId === callRef.current?.peerUserId
        ) {
          const current = callRef.current;
          const stream = localStreamRef.current;
          if (!current || !stream) {
            socket.send(
              JSON.stringify({
                type: "call.end",
                callId: packet.callId,
                conversationId: packet.conversationId,
                targetUserId: packet.userId,
                reason: "resume-failed",
              }),
            );
            return;
          }
          if (restoringRef.current && user.user_id > current.peerUserId) return;
          const peer = createPeer(current);
          stream.getTracks().forEach((track) => peer.addTrack(track, stream));
          void peer
            .createOffer({ iceRestart: true })
            .then(async (offer) => {
              await peer.setLocalDescription(offer);
              sendSignal({
                type: "call.resume.offer",
                callId: current.callId,
                callType: current.type,
                conversationId: current.conversationId,
                targetUserId: current.peerUserId,
                sdp: offer,
              });
            })
            .catch(() => endCall("resume-failed"));
        }
        if (
          packet.type === "call.resume.offer" &&
          packet.callId === callRef.current?.callId &&
          packet.sdp
        ) {
          const peer = peerRef.current;
          const current = callRef.current;
          if (!peer || !current) return;
          void peer
            .setRemoteDescription(packet.sdp)
            .then(async () => {
              for (const candidate of pendingCandidatesRef.current)
                await peer.addIceCandidate(candidate);
              pendingCandidatesRef.current = [];
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              sendSignal({
                type: "call.resume.answer",
                callId: current.callId,
                conversationId: current.conversationId,
                targetUserId: current.peerUserId,
                sdp: answer,
              });
            })
            .catch(() => endCall("resume-failed"));
        }
        if (
          packet.type === "call.resume.answer" &&
          packet.callId === callRef.current?.callId &&
          packet.sdp
        ) {
          const peer = peerRef.current;
          if (!peer) return;
          void peer
            .setRemoteDescription(packet.sdp)
            .then(async () => {
              for (const candidate of pendingCandidatesRef.current)
                await peer.addIceCandidate(candidate);
              pendingCandidatesRef.current = [];
            })
            .catch(() => endCall("resume-failed"));
        }
        if (
          packet.type === "call.ice" &&
          packet.callId === callRef.current?.callId &&
          packet.candidate
        ) {
          if (peerRef.current?.remoteDescription)
            void peerRef.current.addIceCandidate(packet.candidate);
          else pendingCandidatesRef.current.push(packet.candidate);
        }
        if (
          packet.type === "call.end" &&
          packet.callId === callRef.current?.callId
        ) {
          if (packet.reason === "busy") setError("Contact is on another call");
          if (packet.reason === "declined") setError("Call declined");
          if (packet.reason === "media-unavailable")
            setError("Contact could not access their camera or microphone");
          releaseCall();
        }
        if (
          packet.type === "call.error" &&
          (!packet.callId || packet.callId === callRef.current?.callId)
        ) {
          setError(packet.message ?? "Call could not be connected");
          releaseCall();
        }
      };
      socket.onclose = () => {
        if (!closed)
          reconnectTimer = setTimeout(
            connect,
            Math.min(30000, 1000 * 2 ** retry++),
          );
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      releaseCall(true);
    };
  }, [clearCallTimeout, createPeer, endCall, releaseCall, restoreCall, sendSignal, token, updateCall, user]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, call]);
  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = call?.type === "video" ? remoteStream : null;
    remoteVideoRef.current.muted = true;
  }, [call?.type, remoteStream]);
  const remoteAudioEnabled = Boolean(call && call.status !== "incoming");
  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    audio.srcObject = remoteStream;
    if (!remoteAudioEnabled || !remoteStream) return;
    void audio.play().then(
      () => setAudioPlaybackBlocked(false),
      () => setAudioPlaybackBlocked(true),
    );
  }, [remoteAudioEnabled, remoteStream]);

  const enableRemoteAudio = () => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    void audio.play().then(
      () => setAudioPlaybackBlocked(false),
      () => setAudioPlaybackBlocked(true),
    );
  };

  const toggleMute = () => {
    const next = !muted;
    localStream?.getAudioTracks().forEach((track) => (track.enabled = !next));
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOff;
    localStream?.getVideoTracks().forEach((track) => (track.enabled = !next));
    setCameraOff(next);
  };

  return (
    <ChatCallContext.Provider value={{ canStartCall, call, startCall }}>
      {children}
      {call ? (
        <CallOverlay
          call={call}
          localStream={localStream}
          remoteStream={remoteStream}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          remoteAudioRef={remoteAudioRef}
          audioPlaybackBlocked={audioPlaybackBlocked}
          onEnableAudio={enableRemoteAudio}
          muted={muted}
          cameraOff={cameraOff}
          error={error}
          onAccept={() => void acceptCall()}
          onDecline={() => endCall("declined")}
          onEnd={() => endCall()}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
        />
      ) : error ? (
        <div role="alert" className="fixed bottom-6 right-6 z-100 max-w-sm rounded-md bg-[#18243a] px-4 py-3 text-sm font-semibold text-white shadow-xl">
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-3 text-white/70">Dismiss</button>
        </div>
      ) : null}
    </ChatCallContext.Provider>
  );
}

function CallOverlay({
  call,
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  audioPlaybackBlocked,
  muted,
  cameraOff,
  error,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onEnableAudio,
}: {
  call: CallSession;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  audioPlaybackBlocked: boolean;
  muted: boolean;
  cameraOff: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEnableAudio: () => void;
}) {
  const [clock, setClock] = useState(call.startedAt ?? 0);
  const [expandedByUser, setExpandedByUser] = useState(false);
  const [compactBeforeActive, setCompactBeforeActive] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const callPanelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panelX: number;
    panelY: number;
  } | null>(null);
  const isExpanded =
    call.status === "active" ? expandedByUser : !compactBeforeActive;
  useEffect(() => {
    if (!call.startedAt) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [call.startedAt]);
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        if (call.status === "active") setExpandedByUser(false);
        else setCompactBeforeActive(true);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [call.status]);

  const toggleExpanded = async () => {
    if (isExpanded) {
      if (document.fullscreenElement) await document.exitFullscreen();
      if (call.status === "active") setExpandedByUser(false);
      else setCompactBeforeActive(true);
      return;
    }
    if (call.status === "active") setExpandedByUser(true);
    else setCompactBeforeActive(false);
    try {
      await callPanelRef.current?.requestFullscreen();
    } catch {
      // The fixed viewport layout remains available when browser fullscreen is denied.
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isExpanded || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const panel = callPanelRef.current;
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
    const panel = callPanelRef.current;
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

  const duration = call.startedAt
    ? Math.max(0, Math.floor((clock - call.startedAt) / 1000))
    : 0;
  const status =
    call.status === "incoming"
      ? `Incoming ${call.type} call`
      : call.status === "calling"
        ? "Calling..."
        : call.status === "connecting"
          ? "Connecting..."
          : `${String(Math.floor(duration / 60)).padStart(2, "0")}:${String(duration % 60).padStart(2, "0")}`;

  return (
    <section
      ref={callPanelRef}
      className={`fixed z-100 overflow-hidden bg-[#101828] text-white shadow-2xl transition-[width,height,border-radius] duration-300 ${
        isExpanded
          ? "inset-0"
          : `${dragPosition ? "" : "bottom-4 right-4"} h-[30vh] min-h-60 w-[calc(100vw-2rem)] sm:w-[30vw] sm:min-w-80 sm:max-w-120 rounded-md border border-white/15`
      }`}
      style={
        !isExpanded && dragPosition
          ? { left: dragPosition.x, top: dragPosition.y }
          : undefined
      }
      role="dialog"
      aria-modal={isExpanded}
      aria-label={`${call.type} call with ${call.peerName}`}
    >
      {call.status !== "incoming" ? (
        <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" />
      ) : null}
      {call.type === "video" && remoteStream ? (
        <video ref={remoteVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
      ) : (
        <div className={`flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_45%)] px-6 text-center ${isExpanded ? "pb-32" : "pb-16"}`}>
          <span className={`flex items-center justify-center rounded-full bg-[#344054] font-bold shadow-2xl ${isExpanded ? "h-28 w-28 text-3xl" : "h-16 w-16 text-lg"}`}>
            {call.peerName.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
          </span>
          <h2 className={`${isExpanded ? "mt-6 text-3xl" : "mt-3 text-lg"} font-bold`}>{call.peerName}</h2>
          <p className="mt-2 text-sm font-medium text-white/65">{status}</p>
          {error ? <p className="mt-3 text-sm text-[#fda29b]">{error}</p> : null}
        </div>
      )}

      {call.type === "video" && !remoteStream ? (
        <div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${isExpanded ? "pb-32" : "pb-16"}`}>
          <span className={`flex items-center justify-center rounded-full bg-[#344054] font-bold ${isExpanded ? "h-28 w-28 text-3xl" : "h-16 w-16 text-lg"}`}>
            {call.peerName.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
          </span>
          <h2 className={`${isExpanded ? "mt-6 text-3xl" : "mt-3 text-lg"} font-bold`}>{call.peerName}</h2>
          <p className="mt-2 text-sm text-white/65">{status}</p>
        </div>
      ) : null}

      {call.type === "video" && localStream ? (
        <div className={`absolute overflow-hidden rounded-md border border-white/20 bg-black shadow-2xl ${isExpanded ? "right-4 top-4 h-40 w-28 sm:h-52 sm:w-38" : "right-3 top-14 h-20 w-14"}`}>
          <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        </div>
      ) : null}

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        className={`absolute left-0 right-0 top-0 z-10 flex items-center justify-between ${isExpanded ? "p-5" : "cursor-grab touch-none p-3 active:cursor-grabbing"}`}
      >
        <div>
          <p className="text-sm font-bold">{call.peerName}</p>
          <p className="text-xs text-white/60">{status}</p>
        </div>
        <button
          type="button"
          aria-label={isExpanded ? "Minimize call" : "Full screen"}
          onClick={() => void toggleExpanded()}
          className={`flex items-center justify-center rounded-full bg-black/35 backdrop-blur-sm ${isExpanded ? "h-11 w-11" : "h-9 w-9"}`}
        >
          {isExpanded ? <Minimize2 size={19} /> : <Maximize2 size={18} />}
        </button>
      </div>

      <div className={`absolute left-1/2 flex -translate-x-1/2 items-center rounded-md bg-black/45 backdrop-blur-md ${isExpanded ? "bottom-8 gap-4 px-5 py-4" : "bottom-3 gap-3 px-3 py-2"}`}>
        {call.status === "incoming" ? (
          <>
            <CallButton label="Decline" onClick={onDecline} danger><PhoneOff size={22} /></CallButton>
            <CallButton label="Accept" onClick={onAccept} accept>{call.type === "video" ? <Video size={22} /> : <Phone size={22} />}</CallButton>
          </>
        ) : (
          <>
            {audioPlaybackBlocked ? (
              <CallButton label="Enable audio" onClick={onEnableAudio}>
                <Volume2 size={22} />
              </CallButton>
            ) : null}
            <CallButton label={muted ? "Unmute" : "Mute"} onClick={onToggleMute}>{muted ? <MicOff size={22} /> : <Mic size={22} />}</CallButton>
            {call.type === "video" ? (
              <CallButton label={cameraOff ? "Turn camera on" : "Turn camera off"} onClick={onToggleCamera}>{cameraOff ? <VideoOff size={22} /> : <Video size={22} />}</CallButton>
            ) : null}
            <CallButton label="End call" onClick={onEnd} danger><PhoneOff size={22} /></CallButton>
          </>
        )}
      </div>
    </section>
  );
}

function CallButton({ children, label, onClick, danger = false, accept = false }: { children: ReactNode; label: string; onClick: () => void; danger?: boolean; accept?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={`flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition hover:scale-105 ${danger ? "bg-[#d92d20]" : accept ? "bg-[#16a34a]" : "bg-white/15 hover:bg-white/25"}`}>
      {children}
    </button>
  );
}