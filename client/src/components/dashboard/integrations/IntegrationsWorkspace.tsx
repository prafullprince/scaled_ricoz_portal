"use client";

import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { useAppSelector } from "@/redux/hooks";
import { Activity, ArrowDownToLine, ArrowRight, CheckCircle2, ChevronRight, Copy, Link2, LoaderCircle, Plus, RefreshCw, Search, Settings2, ShieldCheck, Users, Webhook, X } from "lucide-react";
import { IntegrationService, type Connector, type IntegrationCatalog, type IntegrationConfig, type IntegrationKind, type IntegrationRun } from "@/services/integration.service";
import { useSelectedDepartment } from "@/components/dashboard/DepartmentRail";
import { CandidateImportForm } from "./CandidateImportForm";
import styles from "./IntegrationsWorkspace.module.css";

function errorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string; errors?: Array<{ message: string }> }>(error)) {
    const data = error.response?.data;
    return [data?.message, ...(data?.errors?.map((entry) => entry.message) ?? [])].filter(Boolean).join(" ") || "Unable to reach the integration service.";
  }
  return error instanceof Error ? error.message : "The integration could not be updated.";
}

function webhookUrl(id: string, catalog: IntegrationCatalog) {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "";
  return `${api.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "")}${catalog.webhookBase}/${id}`;
}
function blankConfig(kind: IntegrationKind, provider: string): IntegrationConfig {
  return {
    name: "", kind, provider, enabled: false, mode: "WEBHOOK", endpoint: "",
    authType: "NONE", authHeader: "X-API-Key", credential: "",
    recordsPath: "", fieldMapping: { externalId: "id", name: "name", email: "email", phone: "phone" },
    opportunityId: null, ownerId: "", intervalMinutes: 15, cursorParam: "", nextCursorPath: "",
  };
}

export function IntegrationsWorkspace({ fixedKind }: { fixedKind?: IntegrationKind } = {}) {
  const user = useAppSelector((state) => state.auth.user);
  const selectedDepartment = useSelectedDepartment();
  const isExecutive = user?.roles.some((role) => role === "ADMIN" || role === "CEO");
  const department = isExecutive ? selectedDepartment : user?.organization_department;
  const departmentKind = department === "SALES"
    ? "LEAD"
    : department === "HR"
      ? "CANDIDATE"
      : undefined;
  const accessKind = fixedKind ?? departmentKind ?? (!isExecutive && (user?.roles.includes("HR") || user?.system_roles?.includes("HR")) ? "CANDIDATE" : undefined);
  return <IntegrationHub key={`${user?.user_id}:${user?.company?.id}:${accessKind ?? "all"}`} fixedKind={accessKind} />;
}

function IntegrationHub({ fixedKind }: { fixedKind?: IntegrationKind }) {
  const user = useAppSelector((state) => state.auth.user);
  const [catalog, setCatalog] = useState<IntegrationCatalog | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [kind, setKind] = useState<IntegrationKind>(fixedKind ?? "CANDIDATE");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<{ config: IntegrationConfig; id?: string; credentialConfigured?: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const [history, setHistory] = useState<Connector | null>(null);
  const [secret, setSecret] = useState<{ id: string; value: string } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    void Promise.all([IntegrationService.catalog(fixedKind, abort.signal), IntegrationService.list(fixedKind, abort.signal)])
      .then(([data, list]) => { if (!abort.signal.aborted) { setCatalog(data); setConnectors(list); setError(""); } })
      .catch((caught: unknown) => { if (!abort.signal.aborted) setError(errorMessage(caught)); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [retry, fixedKind]);

  async function save(input: IntegrationConfig, id?: string) {
    if (busy) return;
    setBusy("save"); setError("");
    try {
      const result = await IntegrationService.save(input, id, fixedKind);
      setConnectors((list) => [result.connector, ...list.filter((entry) => entry._id !== result.connector._id)]);
      setEditor(null);
      if (result.webhookSecret) setSecret({ id: result.connector._id, value: result.webhookSecret });
      setNotice(result.connector.enabled ? "Connector enabled. Imports use the configured destination." : "Connector saved and paused. Enable it when your source is ready.");
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  }
  async function sync(connector: Connector) {
    if (busy) return;
    setBusy(connector._id); setError("");
    try {
      const result = await IntegrationService.sync(connector._id, fixedKind);
      setNotice(`Import ${result.status.toLowerCase()}: ${result.imported} added, ${result.duplicates} duplicates, ${result.failed} failed.`);
      setConnectors((list) => list.map((entry) => entry._id === connector._id ? { ...entry, lastStatus: result.status, lastSyncAt: result.finishedAt } : entry));
      if (result.failed) setHistory(connector);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  }
  async function rotate(connector: Connector) {
    if (busy) return;
    setBusy(connector._id); setError("");
    try { setSecret({ id: connector._id, value: await IntegrationService.rotateSecret(connector._id, fixedKind) }); }
    catch (caught) { setError(errorMessage(caught)); }
    finally { setBusy(""); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice("Copied to clipboard."); }
    catch { setError("Clipboard access was denied. Select and copy the text manually."); }
  }
  const visibleProviders = catalog?.providers.filter((provider) =>
    provider.kind === kind && (!category || provider.category === category)
    && `${provider.name} ${provider.category}`.toLowerCase().includes(query.toLowerCase()),
  ) ?? [];
  const providerCategories = [...new Set(catalog?.providers.filter((provider) => provider.kind === kind).map((provider) => provider.category) ?? [])];
  const visibleConnectors = connectors.filter((entry) => entry.kind === kind);
  return <main className={styles.workspace}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}><Link2 size={14} /> Platform connections</span><h1>Integrations</h1><p>{fixedKind === "CANDIDATE" ? "Configure recruitment sources and import applicants into your hiring pipelines." : fixedKind === "LEAD" ? "Configure Sales lead sources and import leads into the Sales pipeline." : "Bring candidates and leads into one workspace. Map once. Import with confidence."}</p></div>
      <span className={styles.scope}><ShieldCheck size={16} /> Current company only</span>
    </header>
    <div className={styles.metrics}>
      <div><Link2 size={20} /><strong>{connectors.length}</strong><span>Configured connectors</span></div>
      <div><CheckCircle2 size={20} /><strong>{connectors.filter((entry) => entry.enabled).length}</strong><span>Enabled for imports</span></div>
      {fixedKind !== "LEAD" && <div><Users size={20} /><strong>{connectors.filter((entry) => entry.kind === "CANDIDATE").length}</strong><span>Recruitment sources</span></div>}
      {fixedKind !== "CANDIDATE" && <div><ArrowDownToLine size={20} /><strong>{connectors.filter((entry) => entry.kind === "LEAD").length}</strong><span>Sales sources</span></div>}
    </div>
    {error && <div role="alert" className={styles.error}>{error}<button onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>Retry loading</button></div>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {loading ? <p className={styles.empty}><LoaderCircle size={20} className={styles.spin} />Loading integration workspace...</p> : catalog && <>
      {!catalog.encryptionConfigured && <p className={styles.warning}>Server setup required: configure INTEGRATIONS_ENCRYPTION_KEY before saving connectors. Credentials are never stored in plain text.</p>}
      {fixedKind === "CANDIDATE" && <CandidateImportForm opportunities={catalog.opportunities} sources={catalog.providers.filter((provider) => provider.kind === "CANDIDATE").map(({ id, name }) => ({ id, name }))} importedBy={user?.user_name ?? "HR"} />}
      {!fixedKind && <div className={styles.tabs} role="group" aria-label="Integration destination">
        <button aria-pressed={kind === "CANDIDATE"} onClick={() => { setKind("CANDIDATE"); setCategory(""); }}><Users size={16} /> Recruitment</button>
        <button aria-pressed={kind === "LEAD"} onClick={() => { setKind("LEAD"); setCategory(""); }}><ArrowDownToLine size={16} /> Sales leads</button>
      </div>}
      <section className={styles.section}>
        <div className={styles.sectionTitle}><div><h2>Your connections</h2><p>{kind === "CANDIDATE" ? "Imported applicants enter New Application, attached to the selected job or internship." : "Imported leads enter the active New stage, assigned to your selected Sales owner."}</p></div></div>
        {visibleConnectors.length ? <div className={styles.connections}>{visibleConnectors.map((connector) => {
          const provider = catalog.providers.find((entry) => entry.id === connector.provider);
          return <article className={styles.connection} key={connector._id}>
            <div className={styles.connectionTop}><span className={styles.icon}>{provider?.category === "Form platform" ? <Webhook size={20} /> : <Link2 size={20} />}</span><div><h3>{connector.name}</h3><p>{provider?.name} / {connector.mode === "API" ? "JSON API" : provider?.category === "Form platform" ? "Form submission webhook" : "Signed webhook"}</p></div><span className={connector.enabled ? styles.enabled : styles.paused}>{connector.enabled ? "Enabled" : "Paused"}</span></div>
            <div className={styles.connectionMeta}><span>Last run <strong>{connector.lastStatus.replaceAll("_", " ")}</strong></span><span>{connector.lastSyncAt ? new Date(connector.lastSyncAt).toLocaleString() : "No imports yet"}</span></div>
            {connector.mode === "WEBHOOK" && <div className={styles.endpoint}><code>{webhookUrl(connector._id, catalog)}</code><button aria-label={`Copy ${connector.name} webhook URL`} onClick={() => void copy(webhookUrl(connector._id, catalog))}><Copy size={14} /></button></div>}
            <div className={styles.actions}>
              <button onClick={() => { setError(""); setEditor({ config: { ...connector, credential: "" }, id: connector._id, credentialConfigured: connector.credentialConfigured }); }}><Settings2 size={14} />Configure</button>
              <button onClick={() => setHistory(connector)}><Activity size={14} />History</button>
              {connector.mode === "API" ? <button disabled={!connector.enabled || Boolean(busy)} onClick={() => void sync(connector)}><RefreshCw size={14} className={busy === connector._id ? styles.spin : ""} />Sync now</button> : <button disabled={Boolean(busy)} onClick={() => void rotate(connector)}>Rotate secret</button>}
            </div>
          </article>;
        })}</div> : <div className={styles.empty}><Link2 size={24} /><h3>No {kind === "CANDIDATE" ? "recruitment" : "sales"} connections yet</h3><p>Choose a source below to create your first connector.</p></div>}
      </section>
      <section className={styles.section}>
        <div className={styles.sectionTitle}><div><h2>Connector directory</h2><p>Connect form submissions using a signed webhook, or configure an authorized JSON API.</p></div><label className={styles.search}><Search size={16} /><input aria-label="Search integration sources" placeholder="Search sources..." value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        <label className={styles.category}>Source category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{providerCategories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
        <p className={styles.disclaimer}>{catalog.notice}</p>
        <div className={styles.providers}>{visibleProviders.map((provider) => <button className={styles.provider} key={provider.id} disabled={!catalog.encryptionConfigured} onClick={() => { setError(""); setEditor({ config: { ...blankConfig(kind, provider.id), name: `${provider.name} ${kind === "CANDIDATE" ? "applications" : "leads"}` } }); }}>
          <span className={styles.icon}>{provider.category === "Form platform" ? <Webhook size={20} /> : kind === "CANDIDATE" ? <Users size={20} /> : <Link2 size={20} />}</span><span><strong>{provider.name}</strong><small>{provider.category}</small><em>{provider.category === "Form platform" ? "Collect form submissions" : "Configurable API / webhook"}</em></span><Plus size={16} />
        </button>)}</div>
        {!visibleProviders.length && <p className={styles.empty}>No sources match this search.</p>}
      </section>
      <section className={styles.flow}><span>Authorized source</span><ArrowRight size={16} /><span>Validate &amp; deduplicate</span><ArrowRight size={16} /><span>{kind === "CANDIDATE" ? "New Application" : "New sales lead"}</span></section>
      {editor && <ConnectorEditor key={editor.id ?? editor.config.provider} catalog={catalog} config={editor.config} credentialConfigured={editor.credentialConfigured} busy={busy === "save"} error={error} onClose={() => !busy && setEditor(null)} onSave={(input) => void save(input, editor.id)} />}
      {history && <ImportHistory connector={history} onClose={() => setHistory(null)} />}
      {secret && <div className={styles.overlay}><section role="dialog" aria-modal="true" aria-labelledby="secret-heading" className={styles.dialog}>
        <div className={styles.dialogHeader}><h2 id="secret-heading">Webhook signing secret</h2><button aria-label="Close signing secret" onClick={() => setSecret(null)}><X size={20} /></button></div>
        <p>Shown only now. Store it securely in your provider or middleware. Rotating invalidates the previous secret immediately.</p>
        <pre className={styles.secret}>{secret.value}</pre><button className={styles.primary} onClick={() => void copy(secret.value)}><Copy size={16} />Copy signing secret</button>
        <h3>Signed request</h3><p>POST JSON to the URL below. Set <code>X-Ricoz-Timestamp</code> to current Unix seconds and <code>X-Ricoz-Signature</code> to the hex HMAC-SHA256 of <code>timestamp + &quot;.&quot; + exact request body</code>, using this secret. Requests expire after five minutes. Retries are deduplicated by external record ID.</p>
        <pre>{webhookUrl(secret.id, catalog)}</pre>
      </section></div>}
    </>}
  </main>;
}

function ConnectorEditor({ catalog, config, credentialConfigured, busy, error, onClose, onSave }: {
  catalog: IntegrationCatalog; config: IntegrationConfig; credentialConfigured?: boolean;
  busy: boolean; error: string; onClose: () => void; onSave: (config: IntegrationConfig) => void;
}) {
  const [form, setForm] = useState(config);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  function update<K extends keyof IntegrationConfig>(key: K, value: IntegrationConfig[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({
      ...form, credential: form.credential || undefined,
      fieldMapping: Object.fromEntries(Object.entries(form.fieldMapping).filter(([, path]) => path.trim())),
    });
  }
  const owners = catalog.owners.filter((owner) => form.kind === "LEAD" ? owner.department === "SALES" : owner.department === "HR" || owner.executive);
  const requiredFields = new Set(["externalId", "name", form.kind === "CANDIDATE" ? "email" : "phone"]);
  const selectedProvider = catalog.providers.find((entry) => entry.id === form.provider);
  const isFormProvider = selectedProvider?.category === "Form platform";
  const webhookHelp = selectedProvider?.name === "Google Forms"
    ? "Google Forms needs an Apps Script submit trigger or automation to POST signed JSON here; it does not send this webhook format natively. Save the connector first to get the URL and signing secret."
    : selectedProvider?.name === "Zoho Forms"
      ? "Configure Zoho Forms to send each response to this webhook. If Zoho cannot set the required Ricoz HMAC headers, relay through an authorized middleware or automation service."
      : isFormProvider
        ? "Send each form response as JSON to this signed webhook. If the form provider cannot create the required Ricoz HMAC headers, use an authorized middleware or automation service."
        : "Push applicants or leads from your provider or automation tool. A signing secret is issued on creation. Native provider webhooks need a middleware adapter if they use a different signing format.";
  return <div className={styles.overlay}><section role="dialog" aria-modal="true" aria-labelledby="connector-heading" className={styles.dialog}>
    <div className={styles.dialogHeader}><div><span className={styles.eyebrow}>Connection settings</span><h2 id="connector-heading">{selectedProvider?.name}</h2></div><button aria-label="Close connector settings" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    <form onSubmit={submit} className={styles.form}>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <fieldset disabled={busy}><legend>1. Destination &amp; ownership</legend>
        <label>Connection name<input autoFocus required maxLength={100} value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
        <div className={styles.formGrid}>
          {form.kind === "CANDIDATE" && <label>Job / internship<select required value={form.opportunityId ?? ""} onChange={(event) => update("opportunityId", event.target.value || null)}><option value="">Select opportunity</option>{catalog.opportunities.map((entry) => <option key={entry._id} value={entry._id}>{entry.title} ({entry.type})</option>)}</select><small>Create one connector per posting. Each applicant enters New Application.</small></label>}
          <label>{form.kind === "CANDIDATE" ? "Recruiter" : "Sales owner"}<select required value={form.ownerId} onChange={(event) => update("ownerId", event.target.value)}><option value="">Select owner</option>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select><small>{owners.length ? "Only active owners in the selected company are eligible." : "Assign an active company HR / Sales owner before configuring this connector."}</small></label>
        </div>
      </fieldset>
      <fieldset disabled={busy}><legend>2. Connection method</legend>
        <div className={styles.modePicker}><button type="button" aria-pressed={form.mode === "WEBHOOK"} onClick={() => update("mode", "WEBHOOK")}><Webhook size={16} />Signed webhook</button><button type="button" aria-pressed={form.mode === "API"} onClick={() => update("mode", "API")}><RefreshCw size={16} />Fetch JSON API</button></div>
        {form.mode === "WEBHOOK" ? <p className={styles.hint}>{webhookHelp}</p> : <>
          <label>Authorized HTTPS API endpoint<input required type="url" placeholder="https://api.provider.com/applications" value={form.endpoint} onChange={(event) => update("endpoint", event.target.value)} /><small>GET requests only. Public HTTPS, no redirects. Use headers for secrets, not URL parameters.</small></label>
          <div className={styles.formGrid}><label>Authentication<select value={form.authType} onChange={(event) => update("authType", event.target.value as IntegrationConfig["authType"])}><option value="NONE">None</option><option value="BEARER">Bearer token</option><option value="API_KEY">API key header</option></select></label>
            {form.authType !== "NONE" && <label>{credentialConfigured ? "Replace credential (optional)" : "API credential"}<input type="password" autoComplete="new-password" required={!credentialConfigured} value={form.credential ?? ""} placeholder={credentialConfigured ? "Leave blank to keep the stored secret" : "Enter API token"} onChange={(event) => update("credential", event.target.value)} /></label>}
          </div>
          {form.authType === "API_KEY" && <label>API key header<input required value={form.authHeader} onChange={(event) => update("authHeader", event.target.value)} /></label>}
          <div className={styles.formGrid}><label>Sync interval (minutes)<input type="number" min={5} max={1440} required value={form.intervalMinutes} onChange={(event) => update("intervalMinutes", Number(event.target.value))} /></label><label>Records array path<input placeholder="data.applications (blank for root)" value={form.recordsPath} onChange={(event) => update("recordsPath", event.target.value)} /></label></div>
          <details className={styles.advanced}><summary>Cursor pagination <ChevronRight size={14} /></summary><p>One bounded page per sync, up to 100 records. Configure both fields if your provider returns a continuation cursor. Failed rows keep the cursor unchanged for retry.</p><div className={styles.formGrid}><label>Request cursor parameter<input placeholder="cursor" value={form.cursorParam} onChange={(event) => update("cursorParam", event.target.value)} /></label><label>Response next-cursor path<input placeholder="pagination.next_cursor" value={form.nextCursorPath} onChange={(event) => update("nextCursorPath", event.target.value)} /></label></div></details>
        </>}
        {form.mode === "WEBHOOK" && <label>Records path<input placeholder="data.applications (blank for one root record)" value={form.recordsPath} onChange={(event) => update("recordsPath", event.target.value)} /></label>}
      </fieldset>
      <fieldset disabled={busy}><legend>3. Map source fields</legend><p className={styles.hint}>{isFormProvider ? "Map each destination field to the matching form response path. Use the form submission's stable response ID for externalId; candidates need name and email, while Sales leads need name and phone." : "Map dotted JSON paths to platform fields. External ID must be the provider&apos;s stable application / lead ID. Skills and screening answers must be JSON arrays. Missing optional fields stay empty."}</p>
        <div className={styles.mapping}>{(catalog.fields[form.kind] ?? []).map((field) => <label key={field}><span>{field}<small>{requiredFields.has(field) ? "Required" : "Optional"}</small></span><ArrowRight size={14} /><input required={requiredFields.has(field)} aria-label={`${field} source path`} placeholder={`candidate.${field}`} value={form.fieldMapping[field] ?? ""} onChange={(event) => update("fieldMapping", { ...form.fieldMapping, [field]: event.target.value })} /></label>)}</div>
        <button type="button" className={styles.textButton} onClick={() => setPreview((value) => !value)}>View canonical payload example</button>
        {preview && <pre>{JSON.stringify(form.kind === "CANDIDATE"
          ? { id: "application-123", name: "Candidate name", email: "candidate@example.com", phone: "+919876543210", skills: ["React"], education: "B.Tech", screeningAnswers: [{ question: "Availability?", answer: "Immediately" }] }
          : { id: "lead-123", name: "Contact name", phone: "+919876543210", email: "contact@example.com", company: "Example", serviceInterest: "Web development" }, null, 2)}</pre>}
      </fieldset>
      <label className={styles.toggle}><input type="checkbox" checked={form.enabled} disabled={busy} onChange={(event) => update("enabled", event.target.checked)} /><span><strong>Enable connector</strong><small>Paused connectors reject webhooks and do not run scheduled imports.</small></span></label>
      <div className={styles.formFooter}><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={styles.primary} disabled={busy || !owners.length}>{busy ? <LoaderCircle size={16} className={styles.spin} /> : <CheckCircle2 size={16} />}Save connector</button></div>
    </form>
  </section></div>;
}

function ImportHistory({ connector, onClose }: { connector: Connector; onClose: () => void }) {
  const [runs, setRuns] = useState<IntegrationRun[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void IntegrationService.history(connector._id, abort.signal, connector.kind)
      .then((data) => { if (!abort.signal.aborted) setRuns(data); })
      .catch((caught: unknown) => { if (!abort.signal.aborted) setError(errorMessage(caught)); });
    return () => abort.abort();
  }, [connector._id, connector.kind]);
  return <div className={styles.overlay}><section role="dialog" aria-modal="true" aria-labelledby="history-heading" className={styles.dialog}>
    <div className={styles.dialogHeader}><div><span className={styles.eyebrow}>Last 20 import runs</span><h2 id="history-heading">{connector.name}</h2></div><button aria-label="Close import history" onClick={onClose}><X size={20} /></button></div>
    {error ? <p role="alert" className={styles.error}>{error}</p> : !runs ? <p className={styles.empty}>Loading history...</p> : !runs.length ? <p className={styles.empty}>No imports yet. Send a signed webhook or run an enabled API connector.</p> : <div className={styles.history}>{runs.map((run) => <article key={run._id}><div><strong>{run.status}</strong><span>{run.trigger} / {new Date(run.finishedAt).toLocaleString()}</span></div><p>{run.imported} imported / {run.duplicates} duplicates / {run.failed} failed</p>{run.issues.length > 0 && <details><summary>View import errors</summary>{run.issues.map((entry, index) => <p key={index}>{entry.index >= 0 ? `Record ${entry.index + 1}: ` : ""}{entry.message}</p>)}</details>}</article>)}</div>}
  </section></div>;
}
