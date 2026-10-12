"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Copy,
  Pencil,
  Reply,
  Trash2,
  UserX,
  Users,
} from "lucide-react";
import { MESSAGE_EDIT_WINDOW_MS, type ChatMessage } from "@/services/chat.service";
import { emojis } from "./chatHelpers";
import { AttachmentView, LocationView } from "./AttachmentViews";
import styles from "./ChatWorkspace.module.css";

const LONG_PRESS_MS = 2000;
const MOVE_TOLERANCE_PX = 10;
const EDGE_GAP = 8;

type MenuState = { openedAt: number; step: "actions" | "delete"; root: HTMLElement; theme: string };
type MenuPosition = { top: number; left: number; sheet: boolean };

export function MessageBubble({
  message,
  own,
  onReply,
  onReact,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  own: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onEdit: () => void;
  onDelete: (scope: "me" | "everyone") => void;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [pressing, setPressing] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const deleted = Boolean(message.deletedForEveryoneAt);

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenu(null);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  function openMenu() {
    const root = articleRef.current?.closest<HTMLElement>("[data-theme]");
    if (message.pending || !root) return;
    setMenu({ openedAt: Date.now(), step: "actions", root, theme: root.dataset.theme ?? "dark" });
  }

  function cancelPress() {
    if (pressRef.current) window.clearTimeout(pressRef.current.timer);
    pressRef.current = null;
    setPressing(false);
  }

  function startPress(event: ReactPointerEvent<HTMLElement>) {
    if (message.pending || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("a, button, audio, video, input, textarea")) return;
    cancelPress();
    setPressing(true);
    pressRef.current = {
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => {
        pressRef.current = null;
        setPressing(false);
        suppressClickRef.current = true;
        navigator.vibrate?.(30);
        openMenu();
      }, LONG_PRESS_MS),
    };
  }

  function movePress(event: ReactPointerEvent<HTMLElement>) {
    const press = pressRef.current;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE_PX) cancelPress();
  }

  useEffect(() => () => {
    if (pressRef.current) window.clearTimeout(pressRef.current.timer);
  }, []);

  useLayoutEffect(() => {
    if (!menu) return;
    const place = () => {
      const article = articleRef.current;
      const panel = menuRef.current;
      const root = menu.root;
      if (!article || !panel) return;
      const bounds = root.getBoundingClientRect();
      if (bounds.width < 640) {
        setPosition({ top: 0, left: 0, sheet: true });
        return;
      }
      const anchor = article.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const preferredLeft = own ? anchor.right - width : anchor.left;
      const left = Math.min(Math.max(preferredLeft, bounds.left + EDGE_GAP), bounds.right - width - EDGE_GAP);
      const below = anchor.bottom + 6;
      const fitsBelow = below + height <= bounds.bottom - EDGE_GAP;
      const top = fitsBelow ? below : Math.max(anchor.top - height - 6, bounds.top + EDGE_GAP);
      setPosition({ top, left, sheet: false });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [menu, own]);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeMenu();
    };
    const history = articleRef.current?.closest('[aria-label="Message history"]');
    const onScroll = () => closeMenu();
    document.addEventListener("pointerdown", onPointerDown, true);
    history?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      history?.removeEventListener("scroll", onScroll);
    };
  }, [menu, closeMenu]);

  useEffect(() => {
    if (!position) return;
    const panel = menuRef.current;
    (panel?.querySelector<HTMLElement>("[data-menu-focus]") ?? panel)?.focus({ preventScroll: true });
  }, [position, menu?.step]);

  function run(action: () => void) {
    closeMenu();
    action();
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (menu?.step === "delete") setMenu({ ...menu, step: "actions" });
      else closeMenu(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not(:disabled)") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  }

  const canEditText = own && !deleted && Boolean(message.text);
  const editable = canEditText && menu !== null &&
    menu.openedAt - new Date(message.createdAt).getTime() <= MESSAGE_EDIT_WINDOW_MS;

  return (
    <div
      className={`chat-message-enter group flex ${own ? "justify-end" : "justify-start"}`}
      data-own-message={own ? "true" : "false"}
    >
      <article
        ref={articleRef}
        onPointerDown={startPress}
        onPointerMove={movePress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onClickCapture={(event) => {
          if (!suppressClickRef.current) return;
          suppressClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onContextMenu={(event) => {
          if (message.pending) return;
          event.preventDefault();
          cancelPress();
          openMenu();
        }}
        data-pressing={pressing ? "true" : undefined}
        data-menu-open={menu ? "true" : undefined}
        className={`${styles.messageBubble} relative my-0.5 max-w-[90%] rounded-lg px-2.5 pb-1.5 pt-2 shadow-[0_1px_1px_rgba(11,20,26,0.13)] sm:max-w-[72%] ${own ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"}`}
      >
        {!own && message.senderId && typeof message.senderId !== "string" ? (
          <p className="mb-1 text-[11px] font-extrabold text-[#16803c]">
            {message.senderId.name}
          </p>
        ) : !own && !message.senderId ? (
          <p className="mb-1 text-[11px] font-extrabold text-[#667781]">Former member</p>
        ) : null}
        {message.replyTo && typeof message.replyTo !== "string" ? (
          <div className="mb-2 rounded-sm border-l-4 border-[#008069] bg-black/5 px-2.5 py-1.5 text-xs text-[#667781]">
            <p className="font-bold text-[#344054]">
              {!message.replyTo.senderId || typeof message.replyTo.senderId === "string"
                ? "Message"
                : message.replyTo.senderId.name}
            </p>
            <p className="truncate">{message.replyTo.text}</p>
          </div>
        ) : null}
        {deleted ? (
          <p className="flex items-center gap-2 text-sm italic text-[#667085]">
            This message was deleted
          </p>
        ) : (
          <>
            {message.attachments.length ? (
              <div className="mb-2 grid max-w-md grid-cols-1 gap-1.5 sm:grid-cols-2">
                {message.attachments.map((attachment, index) => (
                  <AttachmentView key={`${attachment.url}-${index}`} attachment={attachment} />
                ))}
              </div>
            ) : null}
            {message.location ? <LocationView location={message.location} /> : null}
            {message.text ? (
              <p className="wrap-break-word whitespace-pre-wrap pr-6 text-sm leading-5 text-[#111b21]">
                {message.text}
              </p>
            ) : null}
          </>
        )}
        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] font-medium text-[#7b8494]">
            {message.editedAt ? "edited · " : ""}
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {own ? (
            message.pending ? (
              <Check size={13} className="text-[#8696a0]" />
            ) : (
              <CheckCheck
                size={14}
                className={
                  message.readBy.length > 1
                    ? "text-[#53bdeb]"
                    : "text-[#8696a0]"
                }
              />
            )
          ) : null}
        </div>
        {message.reactions.length ? (
          <div className="absolute -bottom-3 left-2 flex gap-1 rounded-md border border-[#dfe3e8] bg-white px-1.5 py-0.5 text-xs shadow-md">
            {message.reactions.map((reaction) => (
              <span key={reaction.emoji}>
                {reaction.emoji} {reaction.userIds.length}
              </span>
            ))}
          </div>
        ) : null}
        {!message.pending ? (
          <button
            ref={triggerRef}
            type="button"
            onClick={() => (menu ? closeMenu() : openMenu())}
            aria-label="Message actions"
            aria-expanded={Boolean(menu)}
            aria-haspopup="menu"
            className={`${styles.messageTrigger} absolute top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full ${own ? "right-1" : "left-1"} ${menu ? "opacity-100" : "opacity-0 focus:opacity-100 group-hover:opacity-100"}`}
          >
            <ChevronDown size={15} />
          </button>
        ) : null}
      </article>
      {menu
        ? createPortal(
            <div className={styles.workspace} data-theme={menu.theme} style={{ display: "contents" }}>
              {position?.sheet ? <div className={styles.messageMenuBackdrop} aria-hidden="true" /> : null}
              <div
                ref={menuRef}
                role="menu"
                tabIndex={-1}
                aria-label="Message actions"
                onKeyDown={onMenuKeyDown}
                data-sheet={position?.sheet ? "true" : undefined}
                data-ready={position ? "true" : undefined}
                className={styles.messageMenu}
                style={position && !position.sheet ? { top: position.top, left: position.left } : undefined}
              >
                {position?.sheet ? <span className={styles.messageMenuHandle} aria-hidden="true" /> : null}
                {menu.step === "actions" ? (
                  <>
                    {!deleted ? (
                      <div className={styles.messageMenuReactions} role="group" aria-label="React">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            role="menuitem"
                            aria-label={`React with ${emoji}`}
                            onClick={() => run(() => onReact(emoji))}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {!deleted ? <MenuItem icon={Reply} label="Reply" onClick={() => run(onReply)} /> : null}
                    {!deleted && message.text ? (
                      <MenuItem
                        icon={Copy}
                        label="Copy text"
                        onClick={() => run(() => void navigator.clipboard?.writeText(message.text))}
                      />
                    ) : null}
                    {canEditText ? (
                      editable ? (
                        <MenuItem icon={Pencil} label="Edit message" onClick={() => run(onEdit)} />
                      ) : (
                        <MenuItem icon={Pencil} label="Edit message" hint="Only available within 1 hour of sending" disabled />
                      )
                    ) : null}
                    <div className={styles.messageMenuDivider} />
                    <MenuItem icon={Trash2} label="Delete" danger onClick={() => setMenu({ ...menu, step: "delete" })} />
                  </>
                ) : (
                  <>
                    <div className={styles.messageMenuHeader}>
                      <button
                        type="button"
                        data-menu-focus
                        aria-label="Back to message actions"
                        onClick={() => setMenu({ ...menu, step: "actions" })}
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <div>
                        <p>Delete message?</p>
                        <span>Choose who this message is removed for.</span>
                      </div>
                    </div>
                    <MenuItem
                      icon={UserX}
                      label="Delete for me"
                      hint="Removed only from your chat"
                      danger
                      onClick={() => run(() => onDelete("me"))}
                    />
                    {own && !deleted ? (
                      <MenuItem
                        icon={Users}
                        label="Delete for everyone"
                        hint="Everyone sees “This message was deleted”"
                        danger
                        onClick={() => run(() => onDelete("everyone"))}
                      />
                    ) : null}
                    <div className={styles.messageMenuDivider} />
                    <MenuItem label="Cancel" onClick={() => closeMenu(true)} />
                  </>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  danger = false,
  disabled = false,
  onClick,
}: {
  icon?: typeof Reply;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      data-danger={danger ? "true" : undefined}
      onClick={onClick}
      className={styles.messageMenuItem}
    >
      {Icon ? <Icon size={17} aria-hidden="true" /> : <span aria-hidden="true" />}
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </button>
  );
}
