"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  Check,
  FileText,
  ImageIcon,
  LoaderCircle,
  MapPin,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/services/chat.service";
import { AttachmentOption } from "./AttachmentViews";
import { emojis } from "./chatHelpers";

export function MessageComposer({
  composerRef,
  text,
  editingMessage,
  onTextChange,
  onSubmit,
  attachmentMenuOpen,
  onToggleAttachmentMenu,
  imageInputRef,
  videoInputRef,
  documentInputRef,
  onFilesSelected,
  onShareLocation,
  onVoiceRecorded,
  composerPending,
  canSubmit,
}: {
  composerRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  editingMessage: ChatMessage | null;
  onTextChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  attachmentMenuOpen: boolean;
  onToggleAttachmentMenu: () => void;
  imageInputRef: RefObject<HTMLInputElement | null>;
  videoInputRef: RefObject<HTMLInputElement | null>;
  documentInputRef: RefObject<HTMLInputElement | null>;
  onFilesSelected: (files: FileList | null) => void;
  onShareLocation: () => void;
  onVoiceRecorded: (file: File) => void;
  composerPending: boolean;
  canSubmit: boolean;
}) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [emojiMenuOpen, setEmojiMenuOpen] = useState(false);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function releaseRecorder() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setRecordingSeconds(0);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice recording is not supported by this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, { ...(preferredType ? { mimeType: preferredType } : {}), audioBitsPerSecond: 96000 });
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      discardRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (!discardRef.current && chunksRef.current.length) {
          const mimeType = recorder.mimeType.split(";")[0] || "audio/webm";
          const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
          const blob = new Blob(chunksRef.current, { type: mimeType });
          onVoiceRecorded(new File([blob], `voice-note-${Date.now()}.${extension}`, { type: mimeType }));
        }
        releaseRecorder();
      };
      recorder.start(250);
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      toast.error("Allow microphone access to record a voice note");
    }
  }

  function stopRecording(discard = false) {
    discardRef.current = discard;
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
  }

  const elapsed = `${Math.floor(recordingSeconds / 60)}:${String(recordingSeconds % 60).padStart(2, "0")}`;

  return (
    <form
      data-message-composer
      onSubmit={onSubmit}
      className="flex min-h-16 shrink-0 flex-wrap items-end gap-1 bg-[#f0f2f5] px-2 py-2 sm:gap-2 sm:px-4"
    >
      <div className="relative shrink-0" onKeyDown={(event) => {
        if (event.key === "Escape") setEmojiMenuOpen(false);
      }}>
      <button
        type="button"
        aria-label="Choose emoji"
        title="Choose emoji"
        aria-expanded={emojiMenuOpen}
        onClick={() => setEmojiMenuOpen((current) => !current)}
        disabled={recording}
        className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a] disabled:opacity-40"
      >
        <Smile size={22} />
      </button>
      {emojiMenuOpen && !recording ? (
        <div role="group" aria-label="Emoji" className="absolute bottom-13 left-0 z-30 grid w-60 grid-cols-6 rounded-lg border border-[#d1d7db] bg-white p-1 shadow-lg">
          {emojis.map((emoji) => (
            <button key={emoji} type="button" aria-label={`Insert ${emoji}`} className="flex size-9 items-center justify-center rounded text-xl hover:bg-[#f0f2f5]" onClick={() => {
              const start = composerRef.current?.selectionStart ?? text.length;
              const end = composerRef.current?.selectionEnd ?? text.length;
              onTextChange(`${text.slice(0, start)}${emoji}${text.slice(end)}`);
              setEmojiMenuOpen(false);
              requestAnimationFrame(() => {
                composerRef.current?.focus();
                composerRef.current?.setSelectionRange(start + emoji.length, start + emoji.length);
              });
            }}>{emoji}</button>
          ))}
        </div>
      ) : null}
      </div>
      <div className="relative mb-0.5">
        <button
          type="button"
          aria-label="Add attachment"
          aria-expanded={attachmentMenuOpen}
          onClick={onToggleAttachmentMenu}
          disabled={recording}
          className="flex h-10 w-10 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a]"
        >
          <Paperclip size={21} />
        </button>
        {attachmentMenuOpen ? (
          <div className="absolute bottom-12 left-0 z-30 w-52 rounded-md border border-[#dfe3e8] bg-white p-1.5 shadow-[0_14px_36px_rgba(24,36,58,0.18)]">
            <AttachmentOption icon={<ImageIcon size={18} />} label="Photos and images" onClick={() => imageInputRef.current?.click()} />
            <AttachmentOption icon={<Video size={18} />} label="Video" onClick={() => videoInputRef.current?.click()} />
            <AttachmentOption icon={<FileText size={18} />} label="Document" onClick={() => documentInputRef.current?.click()} />
            <AttachmentOption icon={<MapPin size={18} />} label="Location" onClick={onShareLocation} />
          </div>
        ) : null}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
          multiple
          hidden
          onChange={(event) => {
            onFilesSelected(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
          multiple
          hidden
          onChange={(event) => {
            onFilesSelected(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
          multiple
          hidden
          onChange={(event) => {
            onFilesSelected(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {recording ? (
        <div className="flex min-h-11 flex-1 items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#c91d20]" />
          <span className="text-sm font-bold text-[#c91d20]">Recording</span>
          <span className="text-sm tabular-nums text-[#667085]">{elapsed}</span>
          <span className="ml-auto text-xs text-[#8a93a3]">Tap stop to attach</span>
        </div>
      ) : (
        <textarea
          ref={composerRef}
          rows={1}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={editingMessage ? "Edit message" : "Type a message"}
          aria-label={editingMessage ? "Edit message" : "Type a message"}
          className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-lg border-0 bg-white px-3 py-3 text-sm text-[#111b21] outline-none placeholder:text-[#667781]"
        />
      )}
      {recording ? (
        <>
          <button type="button" onClick={() => stopRecording(true)} aria-label="Cancel voice note" title="Cancel recording" className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-md text-[#667085] hover:bg-[#f1f3f6]">
            <Trash2 size={19} />
          </button>
          <button type="button" onClick={() => stopRecording()} aria-label="Stop voice recording" title="Stop and attach" className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-md bg-[#c91d20] text-white shadow-[0_6px_16px_rgba(201,29,32,0.20)] hover:bg-[#ad181b]">
            <Square size={16} fill="currentColor" />
          </button>
        </>
      ) : canSubmit ? (
        <button
          type="submit"
          disabled={composerPending}
          aria-label={editingMessage ? "Save edited message" : "Send message"}
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#008069] text-white transition hover:bg-[#006c59]"
        >
          {composerPending ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : editingMessage ? (
            <Check size={19} />
          ) : (
            <Send size={18} />
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void startRecording()}
          disabled={composerPending || Boolean(editingMessage)}
          aria-label="Record voice message"
          title="Voice message"
          className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a] disabled:opacity-40"
        >
          <Mic size={21} />
        </button>
      )}
    </form>
  );
}
