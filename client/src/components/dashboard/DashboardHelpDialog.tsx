"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  ExternalLink,
  LoaderCircle,
  Mail,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import {
  HelpOptionsService,
  type HelpLink,
  type HelpOptions,
} from "@/services/help-options.service";
import styles from "./DashboardHelpDialog.module.css";

type HelpTab = "CONTACT" | "SELF_HELP" | "USEFUL_LINKS";
type HelpTopic = "QUESTION" | "ISSUE" | "FEEDBACK";

const EMPTY_OPTIONS: HelpOptions = { selfHelp: [], usefulLinks: [] };
const TAB_ITEMS: Array<{ id: HelpTab; label: string }> = [
  { id: "CONTACT", label: "Contact Us" },
  { id: "SELF_HELP", label: "Self Help" },
  { id: "USEFUL_LINKS", label: "Useful Links" },
];

export function DashboardHelpDialog({ onClose }: { onClose: () => void }) {
  const user = useAppSelector((state) => state.auth.user);
  const pathname = usePathname();
  const canEdit = Boolean(user?.roles.some((role) => role === "CEO" || role === "ADMIN"));
  const [tab, setTab] = useState<HelpTab>("CONTACT");
  const [manageLinks, setManageLinks] = useState(false);
  const [options, setOptions] = useState<HelpOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [topic, setTopic] = useState<HelpTopic>("QUESTION");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState("");
  const contactFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    let active = true;
    HelpOptionsService.get()
      .then((result) => {
        if (!active) return;
        setOptions(result);
        setOptionsLoaded(true);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const startContact = (selectedTopic: HelpTopic) => {
    setTopic(selectedTopic);
    setSubject(
      selectedTopic === "ISSUE"
        ? "Dashboard issue report"
        : selectedTopic === "FEEDBACK"
          ? "Product feedback"
          : "",
    );
    setMessage(selectedTopic === "ISSUE" ? `Page where the issue occurred: ${pathname}\n\nWhat happened?\n` : "");
    setSent("");
    requestAnimationFrame(() => contactFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const sendContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSending(true);
    setSent("");
    try {
      const confirmation = await HelpOptionsService.send({
        name: user.user_name,
        email: user.user_email,
        subject: subject.trim() || "Ricoz support request",
        message: `[${topicLabel(topic)}]\n\n${message.trim()}`,
      });
      setSent(confirmation);
      setMessage("");
      toast.success("Your message was sent to Ricoz support.");
    } catch (error) {
      const text = errorMessage(error);
      setSent(text);
      toast.error(text);
    } finally {
      setSending(false);
    }
  };

  const saveLinks = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingLinks(true);
    try {
      const saved = await HelpOptionsService.save(options);
      setOptions(saved);
      setManageLinks(false);
      toast.success("Help links updated.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingLinks(false);
    }
  };

  const activeLinks = tab === "SELF_HELP" ? options.selfHelp : options.usefulLinks;

  return (
    <div className={styles.overlay} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="help-options-title">
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Ricoz support</span>
            <h2 id="help-options-title">{manageLinks ? "Manage help links" : "Help Options"}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close help options"><X size={19} /></button>
        </header>

        {!manageLinks ? (
          <div className={styles.tabs} role="tablist" aria-label="Help sections">
            {TAB_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? styles.activeTab : ""}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <p className={styles.manageHint}>These links are visible to everyone in Help Options. Use a Ricoz dashboard path or an https:// address.</p>
        )}

        <div className={styles.body}>
          {tab === "CONTACT" && loadError ? <p className={styles.error} role="alert">Help links could not be loaded: {loadError}</p> : null}
          {manageLinks ? (
            <form onSubmit={saveLinks} className={styles.manageForm}>
              {(["selfHelp", "usefulLinks"] as const).map((list) => (
                <fieldset key={list} className={styles.linkFieldset}>
                  <legend>{list === "selfHelp" ? "Self Help" : "Useful Links"}</legend>
                  {options[list].map((item, index) => (
                    <div className={styles.linkEditor} key={item.id}>
                      <label>Title<input required maxLength={100} value={item.title} onChange={(event) => updateItem(list, index, "title", event.target.value, setOptions)} /></label>
                      <label>Description<input required maxLength={300} value={item.description} onChange={(event) => updateItem(list, index, "description", event.target.value, setOptions)} /></label>
                      <label>URL<input required maxLength={1000} value={item.url} onChange={(event) => updateItem(list, index, "url", event.target.value, setOptions)} placeholder="/dashboard/... or https://..." /></label>
                      <button type="button" className={styles.removeLink} onClick={() => setOptions((current) => ({ ...current, [list]: current[list].filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Remove ${item.title}`}><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {options[list].length < 20 ? (
                    <button type="button" className={styles.addLink} onClick={() => setOptions((current) => ({ ...current, [list]: [...current[list], newLink()] }))}>
                      <Plus size={14} /> Add link
                    </button>
                  ) : null}
                </fieldset>
              ))}
              <div className={styles.formActions}>
                <button type="button" className={styles.secondaryButton} disabled={savingLinks} onClick={() => setManageLinks(false)}>Cancel</button>
                <button type="submit" className={styles.primaryButton} disabled={savingLinks}>
                  {savingLinks ? <LoaderCircle size={15} className={styles.spinner} /> : <Save size={15} />}
                  Save links
                </button>
              </div>
            </form>
          ) : tab === "CONTACT" ? (
            <div className={styles.contactLayout}>
              <div className={styles.contactChoices}>
                <button type="button" className={styles.contactChoice} onClick={() => startContact("QUESTION")}>
                  <span className={styles.choiceIcon}><Mail size={18} /></span>
                  <span><strong>Write to us</strong><small>Send a message directly to Ricoz support.</small></span>
                  <ArrowUpRight size={16} />
                </button>
                <button type="button" className={styles.contactChoice} onClick={() => startContact("ISSUE")}>
                  <span className={styles.choiceIcon}><MessageSquareText size={18} /></span>
                  <span><strong>Report an issue</strong><small>Tell us what went wrong and where.</small></span>
                  <ArrowUpRight size={16} />
                </button>
                <div className={styles.supportNote}>
                  <CircleHelp size={16} />
                  <p>Your message is emailed to the Ricoz support address configured for this system.</p>
                </div>
              </div>
              <form ref={contactFormRef} className={styles.contactForm} onSubmit={sendContact}>
                <h3>{topic === "ISSUE" ? "Report an issue" : topic === "FEEDBACK" ? "Share feedback" : "Write to support"}</h3>
                <p className={styles.formIdentity}>Sending as <strong>{user?.user_name}</strong> · {user?.user_email}</p>
                <label>Subject<input required minLength={3} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="How can we help?" /></label>
                <label>Message<textarea required minLength={10} maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe your question or issue. Include steps to reproduce it if possible." /></label>
                {sent ? <p role="status" className={sent.startsWith("Thanks") ? styles.success : styles.error}>{sent}</p> : null}
                <button type="submit" className={styles.primaryButton} disabled={sending || !user?.user_email}>
                  {sending ? <LoaderCircle size={15} className={styles.spinner} /> : <Send size={15} />}
                  {sending ? "Sending..." : "Send to support"}
                </button>
                {!user?.user_email ? <p className={styles.error}>Your account has no email address. Update your account details before contacting support.</p> : null}
              </form>
            </div>
          ) : (
            <div className={styles.linkList}>
              {loading ? <div className={styles.loading}><LoaderCircle size={18} className={styles.spinner} />Loading help links...</div> : null}
              {loadError ? <p className={styles.error} role="alert">{loadError}</p> : null}
              {!loading && !loadError && activeLinks.map((item) => {
                const Icon = tab === "SELF_HELP" ? BookOpen : ExternalLink;
                const external = item.url.startsWith("https://");
                const content = (
                  <>
                    <span className={styles.linkIcon}><Icon size={17} /></span>
                    <span className={styles.linkText}><strong>{item.title}</strong><small>{item.description}</small></span>
                    {external ? <ExternalLink size={15} className={styles.linkEndIcon} /> : <ArrowUpRight size={16} className={styles.linkEndIcon} />}
                  </>
                );
                return external ? (
                  <a key={item.id} className={styles.helpLink} href={item.url} target="_blank" rel="noreferrer">{content}</a>
                ) : (
                  <Link key={item.id} className={styles.helpLink} href={item.url} onClick={onClose}>{content}</Link>
                );
              })}
              {!loading && !loadError && activeLinks.length === 0 ? <p className={styles.empty}>No links have been added yet.</p> : null}
            </div>
          )}
        </div>

        {canEdit && optionsLoaded && !manageLinks ? (
          <footer className={styles.footer}>
            <button type="button" className={styles.manageButton} onClick={() => setManageLinks(true)}>
              <Pencil size={13} />Manage help links
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function updateItem(
  list: "selfHelp" | "usefulLinks",
  index: number,
  key: keyof HelpLink,
  value: string,
  setOptions: React.Dispatch<React.SetStateAction<HelpOptions>>,
) {
  setOptions((current) => ({
    ...current,
    [list]: current[list].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }));
}

function newLink(): HelpLink {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `help-${Date.now()}`,
    title: "",
    description: "",
    url: "",
  };
}

function topicLabel(topic: HelpTopic) {
  if (topic === "ISSUE") return "Issue report";
  if (topic === "FEEDBACK") return "Product feedback";
  return "Support question";
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; errors?: Array<{ message?: string }> } } }).response;
    const message = response?.data?.message;
    const details = response?.data?.errors?.map((item) => item.message).filter(Boolean).join(" ");
    if (message || details) return [message, details].filter(Boolean).join(" ");
  }
  return error instanceof Error ? error.message : "This request could not be completed. Please try again.";
}
