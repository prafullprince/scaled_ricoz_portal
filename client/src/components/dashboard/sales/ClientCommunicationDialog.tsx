"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, Clock3, LoaderCircle, Mail, MessageCircle, Paperclip, RefreshCw, Send, X } from "lucide-react";
import {
  SalesService,
  type SalesClientCampaign,
  type SalesClientCampaignRecipient,
  type SalesClientCampaignTemplate,
  type SalesClientWhatsAppAccount,
} from "@/services/sales.service";
import { RecruitmentService } from "@/services/recruitment.service";

type CampaignChannel = "EMAIL" | "WHATSAPP";

function splitAddresses(value: string) {
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}

function readAttachment(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result.split(",")[1] : "";
      if (!value) reject(new Error(`Unable to read ${file.name}`));
      else resolve(value);
    };
    reader.readAsDataURL(file);
  });
}

function suggestedVariable(name: string, index: number) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  if (key.includes("last")) return "{{lastName}}";
  if (key.includes("first")) return "{{firstName}}";
  if (key.includes("name")) return "{{name}}";
  if (key.includes("company")) return "{{company}}";
  if (key.includes("phone")) return "{{phone}}";
  if (key.includes("email")) return "{{email}}";
  return index === 0 ? "{{name}}" : index === 1 ? "{{company}}" : "";
}

export function ClientCommunicationDialog({
  channel,
  leadIds,
  sourceType = "SALES",
  onClose,
  onCreated,
}: {
  channel: CampaignChannel;
  leadIds: string[];
  sourceType?: "SALES" | "CANDIDATE";
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [accounts, setAccounts] = useState<SalesClientWhatsAppAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [templates, setTemplates] = useState<SalesClientCampaignTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("");
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);
  const [confirmWhatsAppOptIn, setConfirmWhatsAppOptIn] = useState(false);
  const [confirmContactPermission, setConfirmContactPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(channel === "WHATSAPP");
  const [error, setError] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.name === templateName && template.language === templateLanguage),
    [templateLanguage, templateName, templates],
  );

  useEffect(() => {
    if (channel !== "WHATSAPP") return;
    let active = true;
    async function loadAccountsAndTemplates() {
      try {
        const result = sourceType === "CANDIDATE"
          ? await RecruitmentService.candidateWhatsAppCampaignAccounts()
          : await SalesService.whatsappCampaignAccounts();
        if (!active) return;
        setAccounts(result);
        const defaultAccountId = result[0]?._id ?? "";
        setAccountId(defaultAccountId);
        if (!defaultAccountId) {
          setError("Connect a WhatsApp Business account in Marketing → Social first.");
          return;
        }
        const approvedTemplates = sourceType === "CANDIDATE"
          ? await RecruitmentService.candidateWhatsAppCampaignTemplates(defaultAccountId)
          : await SalesService.whatsappCampaignTemplates(defaultAccountId);
        if (!active) return;
        setTemplates(approvedTemplates);
        setTemplateName(approvedTemplates[0]?.name ?? "");
        setTemplateLanguage(approvedTemplates[0]?.language ?? "");
        setTemplateVariables(approvedTemplates[0]?.variables.map(suggestedVariable) ?? []);
        if (!approvedTemplates.length) setError("No approved WhatsApp templates are available for this account.");
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load WhatsApp accounts and templates.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAccountsAndTemplates();
    return () => { active = false; };
  }, [channel, sourceType]);

  async function changeWhatsAppAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    setTemplates([]);
    setTemplateName("");
    setTemplateLanguage("");
    setTemplateVariables([]);
    setError("");
    setLoading(true);
    try {
      const approvedTemplates = sourceType === "CANDIDATE"
        ? await RecruitmentService.candidateWhatsAppCampaignTemplates(nextAccountId)
        : await SalesService.whatsappCampaignTemplates(nextAccountId);
      setTemplates(approvedTemplates);
      setTemplateName(approvedTemplates[0]?.name ?? "");
      setTemplateLanguage(approvedTemplates[0]?.language ?? "");
      setTemplateVariables(approvedTemplates[0]?.variables.map(suggestedVariable) ?? []);
      if (!approvedTemplates.length) setError("No approved WhatsApp templates are available for this account.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load approved templates.");
    } finally {
      setLoading(false);
    }
  }

  function chooseAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.length > 5 || total > 5 * 1024 * 1024) {
      setError("Choose up to 5 email attachments with a combined size of 5 MB or less.");
      event.target.value = "";
      return;
    }
    setError("");
    setAttachments(files);
  }

  function chooseTemplate(value: string) {
    const template = templates.find((item) => `${item.name}|${item.language}` === value);
    if (!template) return;
    setTemplateName(template.name);
    setTemplateLanguage(template.language);
    setTemplateVariables(template.variables.map(suggestedVariable));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const encodedAttachments = channel === "EMAIL"
        ? await Promise.all(attachments.map(async (file) => ({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          contentBase64: await readAttachment(file),
        })))
        : [];
      const campaignInput = {
        leadIds,
        channel,
        ...(channel === "EMAIL" ? {
          subject,
          body,
          cc: splitAddresses(cc),
          bcc: splitAddresses(bcc),
          attachments: encodedAttachments,
        } : {
          accountId,
          templateName,
          templateLanguage,
          templateVariables,
          confirmWhatsAppOptIn,
          body: selectedTemplate?.body ?? "",
        }),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        ...(sourceType === "CANDIDATE" ? { confirmContactPermission } : {}),
      };
      const result = sourceType === "CANDIDATE"
        ? await RecruitmentService.createCandidateCampaign({ ...campaignInput, confirmContactPermission })
        : await SalesService.createClientCampaign(campaignInput);
      onCreated(
        `${result.name}: ${result.queued} message${result.queued === 1 ? "" : "s"} queued${result.skipped ? ` · ${result.skipped} skipped` : ""}${result.scheduledAt ? ` for ${new Date(result.scheduledAt).toLocaleString()}` : ""}.`,
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The campaign could not be created.");
    } finally {
      setBusy(false);
    }
  }

  const groupName = sourceType === "CANDIDATE" ? "candidates" : "clients";
  const title = `${channel === "EMAIL" ? "Email" : "WhatsApp"} ${groupName}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Close campaign composer" onClick={() => { if (!busy) onClose(); }} className="absolute inset-0 cursor-default" />
      <section role="dialog" aria-modal="true" aria-labelledby="client-campaign-title" className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className={`grid size-10 place-items-center rounded-xl ${channel === "EMAIL" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
              {channel === "EMAIL" ? <Mail size={18} /> : <MessageCircle size={18} />}
            </span>
            <div>
              <h2 id="client-campaign-title" className="text-lg font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500">To {leadIds.length.toLocaleString()} selected {sourceType === "CANDIDATE" ? "candidate" : "client"}{leadIds.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <button type="button" disabled={busy} onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
        </header>
        <form onSubmit={(event) => void submit(event)} className="space-y-4 px-5 py-5 sm:px-7">
          {channel === "EMAIL" ? (
            <>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Subject
                <input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Hello {{firstName}}" className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Message
                <textarea required maxLength={4000} rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder={"Hi {{firstName}},\n\nI wanted to get in touch about {{company}}."} className="resize-y rounded-lg border border-slate-300 p-3 text-sm font-normal leading-6 outline-none focus:border-blue-500" />
              </label>
              <p className="-mt-2 text-[11px] text-slate-500">Personalize with {"{{name}}"}, {"{{firstName}}"}, {"{{lastName}}"}, {"{{company}}"}, {"{{email}}"}, or {"{{phone}}"}.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">CC
                  <input value={cc} onChange={(event) => setCc(event.target.value)} placeholder="person@example.com, ..." className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500" />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">BCC
                  <input value={bcc} onChange={(event) => setBcc(event.target.value)} placeholder="person@example.com, ..." className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-blue-500" />
                </label>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Paperclip size={15} /> Add attachments (5 MB total maximum)
                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv" onChange={chooseAttachments} className="sr-only" />
              </label>
              {attachments.length ? <p className="text-[11px] text-slate-500">{attachments.map((file) => file.name).join(" · ")}</p> : null}
              <p className="text-[11px] text-amber-800">{sourceType === "CANDIDATE" ? "Candidates without a valid email address will be skipped." : "Clients marked as opted out of email, or without a valid email, will be skipped."}</p>
              {sourceType === "CANDIDATE" ? (
                <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <input type="checkbox" checked={confirmContactPermission} onChange={(event) => setConfirmContactPermission(event.target.checked)} className="mt-1 accent-emerald-700" required />
                  I confirm I have permission to email these candidates.
                </label>
              ) : null}
            </>
          ) : (
            <>
              {loading && !accounts.length ? <div className="flex items-center gap-2 py-3 text-sm text-slate-500"><LoaderCircle size={15} className="animate-spin" />Loading connected WhatsApp accounts…</div> : null}
              {accounts.length ? (
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">WhatsApp Business account
                  <select value={accountId} onChange={(event) => void changeWhatsAppAccount(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">
                    {accounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
                  </select>
                </label>
              ) : null}
              {templates.length ? (
                <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Approved message template
                  <select value={selectedTemplate ? `${selectedTemplate.name}|${selectedTemplate.language}` : ""} onChange={(event) => chooseTemplate(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal">
                    {templates.map((template) => <option key={`${template.name}|${template.language}`} value={`${template.name}|${template.language}`}>{template.name} · {template.language}</option>)}
                  </select>
                </label>
              ) : null}
              {selectedTemplate ? (
                <>
                  <div className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{selectedTemplate.body || "This approved template has no text body."}</div>
                  {selectedTemplate.variables.map((variable, index) => (
                    <label key={`${variable}-${index}`} className="grid gap-1.5 text-xs font-semibold text-slate-700">
                      Template variable {variable}
                      <input value={templateVariables[index] ?? ""} onChange={(event) => setTemplateVariables((current) => current.map((value, variableIndex) => variableIndex === index ? event.target.value : value))} placeholder="{{firstName}}" className="h-10 rounded-lg border border-slate-300 px-3 text-sm font-normal outline-none focus:border-emerald-500" />
                    </label>
                  ))}
                  <p className="text-[11px] text-slate-500">Template values can use {"{{name}}"}, {"{{firstName}}"}, {"{{lastName}}"}, {"{{company}}"}, {"{{email}}"}, or {"{{phone}}"} and will be personalized for each client.</p>
                </>
              ) : null}
              <p className="text-[11px] text-amber-800">Only Meta-approved templates are available for Client Lists campaigns. Phone numbers must include an international country code.</p>
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                <input type="checkbox" checked={confirmWhatsAppOptIn} onChange={(event) => setConfirmWhatsAppOptIn(event.target.checked)} className="mt-1 accent-emerald-700" />
                {sourceType === "CANDIDATE" ? "I confirm I have permission to contact these candidates and they opted in to receive WhatsApp messages." : "I confirm the selected clients opted in to receive WhatsApp messages. Clients marked as opted out will still be skipped."}
              </label>
              {sourceType === "CANDIDATE" ? (
                <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
                  <input type="checkbox" checked={confirmContactPermission} onChange={(event) => setConfirmContactPermission(event.target.checked)} className="mt-1 accent-emerald-700" required />
                  I confirm I have permission to contact these candidates.
                </label>
              ) : null}
            </>
          )}

          <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Schedule (optional)
            <span className="relative">
              <Clock3 size={15} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm font-normal" />
            </span>
          </label>

          {error ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</div> : null}
          <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy || (channel === "WHATSAPP" && (!selectedTemplate || !accountId || !confirmWhatsAppOptIn))} className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
              {scheduledAt ? "Schedule campaign" : "Send campaign"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function ClientCampaignHistory({
  sourceType = "SALES",
  onClose,
}: {
  sourceType?: "SALES" | "CANDIDATE";
  onClose: () => void;
}) {
  const [campaigns, setCampaigns] = useState<SalesClientCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState("");
  const [recipientCampaignId, setRecipientCampaignId] = useState("");
  const [recipients, setRecipients] = useState<SalesClientCampaignRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientPages, setRecipientPages] = useState(1);
  const listName = sourceType === "CANDIDATE" ? "Candidates Lists" : "Client Lists";

  const loadCampaigns = useCallback(async () => {
    return sourceType === "CANDIDATE"
      ? RecruitmentService.candidateCampaigns()
      : SalesService.clientCampaigns();
  }, [sourceType]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      loadCampaigns()
        .then((result) => {
          if (!active) return;
          setCampaigns(result);
          setError("");
        })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : "Campaign history could not be loaded.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [loadCampaigns]);

  async function refresh() {
    try {
      setCampaigns(await loadCampaigns());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campaign history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function retry(campaignId: string) {
    setRetrying(campaignId);
    setError("");
    try {
      if (sourceType === "CANDIDATE") await RecruitmentService.retryCandidateCampaign(campaignId);
      else await SalesService.retryClientCampaign(campaignId);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campaign messages could not be retried.");
    } finally {
      setRetrying("");
    }
  }

  async function showRecipients(campaignId: string, page = 1) {
    setRecipientCampaignId(campaignId);
    setRecipientPage(page);
    setRecipientsLoading(true);
    setError("");
    try {
      const result = sourceType === "CANDIDATE"
        ? await RecruitmentService.candidateCampaignRecipients(campaignId, page)
        : await SalesService.clientCampaignRecipients(campaignId, page);
      setRecipients(result.recipients);
      setRecipientPages(result.totalPages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Campaign recipients could not be loaded.");
    } finally {
      setRecipientsLoading(false);
    }
  }

  const statuses = ["QUEUED", "SENT", "DELIVERED", "READ", "REPLIED", "FAILED", "BOUNCED", "SKIPPED"];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Close campaign history" onClick={onClose} className="absolute inset-0 cursor-default" />
      <section role="dialog" aria-modal="true" aria-labelledby="client-campaign-history-title" className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <h2 id="client-campaign-history-title" className="text-lg font-bold text-slate-900">{listName} communication campaigns</h2>
            <p className="text-xs text-slate-500">Delivery results refresh every 15 seconds.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void refresh()} aria-label="Refresh campaign history" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={16} /></button>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
          </div>
        </header>
        <div className="space-y-3 p-5 sm:p-7">
          {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}
          {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" />Loading campaigns…</div> : null}
          {!loading && !campaigns.length ? <p className="py-8 text-center text-sm text-slate-500">No communication campaigns yet.</p> : null}
          {campaigns.map((campaign) => (
            <article key={campaign._id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{campaign.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{campaign.channel} · {campaign.status.replaceAll("_", " ")} · {new Date(campaign.createdAt).toLocaleString()}</p>
                  {campaign.scheduledAt ? <p className="mt-1 text-[11px] text-slate-500">Scheduled for {new Date(campaign.scheduledAt).toLocaleString()}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void showRecipients(campaign._id, 1)} className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">View recipients</button>
                  {(campaign.counts.FAILED ?? 0) > 0 ? (
                    <button type="button" disabled={retrying === campaign._id} onClick={() => void retry(campaign._id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50">
                      {retrying === campaign._id ? <LoaderCircle size={13} className="animate-spin" /> : <RefreshCw size={13} />}Retry failed
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {statuses.map((status) => {
                  const count = campaign.counts[status] ?? 0;
                  if (!count) return null;
                  return <span key={status} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status === "FAILED" || status === "BOUNCED" ? "bg-red-50 text-red-700" : status === "READ" || status === "REPLIED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{status.toLowerCase()} {count}</span>;
                })}
              </div>
              {recipientCampaignId === campaign._id ? (
                <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  {recipientsLoading ? <p className="flex items-center gap-2 p-4 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin" />Loading recipients…</p> : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[580px] text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{[sourceType === "CANDIDATE" ? "Candidate" : "Client", "Destination", "Status", "Details"].map((heading) => <th key={heading} className="px-3 py-2 font-semibold">{heading}</th>)}</tr></thead>
                          <tbody>{recipients.map((recipient) => <tr key={recipient._id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-800">{recipient.name}</td>
                            <td className="px-3 py-2 text-slate-600">{recipient.recipient}</td>
                            <td className="px-3 py-2">{recipient.status.toLowerCase()}</td>
                            <td className="max-w-64 truncate px-3 py-2 text-slate-500">{recipient.error || (recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : "Waiting to send")}</td>
                          </tr>)}</tbody>
                        </table>
                      </div>
                      <footer className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">
                        <span>Page {recipientPage} of {recipientPages}</span>
                        <div className="flex gap-2">
                          <button type="button" disabled={recipientPage <= 1 || recipientsLoading} onClick={() => void showRecipients(campaign._id, recipientPage - 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Previous</button>
                          <button type="button" disabled={recipientPage >= recipientPages || recipientsLoading} onClick={() => void showRecipients(campaign._id, recipientPage + 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40">Next</button>
                        </div>
                      </footer>
                    </>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
