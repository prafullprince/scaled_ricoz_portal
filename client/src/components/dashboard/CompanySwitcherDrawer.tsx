"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Building2, Check, Loader2, LogOut, Plus, Search, Settings, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import type { IUser } from "@/redux/slice/auth.slice";
import { CompanyService, type Company, type CompanyCategory } from "@/services/company.service";
import { getChatTheme, subscribeChatTheme } from "@/lib/chat/theme";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/redux/hooks";
import { setUser } from "@/redux/slice/auth.slice";
import styles from "./CompanySwitcherDrawer.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  user: IUser;
  canCreateCompany: boolean;
  hrefFor: (path: string) => string;
  onLogout: () => void;
};

const accountLinks = [
  { href: "/dashboard/profile", label: "Profile", icon: UserRound },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/security", label: "Security", icon: ShieldCheck },
];

export function CompanySwitcherDrawer({ open, onClose, user, canCreateCompany, hrefFor, onLogout }: Props) {
  const theme = useSyncExternalStore(subscribeChatTheme, getChatTheme, () => "light");
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [categories, setCategories] = useState<CompanyCategory[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [form, setForm] = useState({ name: "", category: "", description: "" });
  const panelRef = useRef<HTMLDivElement>(null);
  const activeId = user.company?.id ?? null;
  const router = useRouter();
  const dispatch = useAppDispatch();

  const load = useCallback(async (searchTerm = "") => {
    try {
      const list = await CompanyService.list({ search: searchTerm.trim() || undefined });
      setCompanies(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const fetchTimer = setTimeout(() => {
      void CompanyService.categories().then(setCategories).catch(() => setCategories([]));
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(fetchTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(search), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, open, search]);

  async function switchTo(company: Company) {
    if (company.id === activeId || switchingId) return;
    setSwitchingId(company.id);
    try {
      const activeUser = await CompanyService.activate(company.id);
      dispatch(setUser(activeUser));
      onClose();
      router.replace("/dashboard");
      router.refresh();
    } catch {
      toast.error(`Could not switch to ${company.name}. Your current company is unchanged.`);
    } finally {
      setSwitchingId(null);
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) return;
    setSaving(true);
    try {
      const company = await CompanyService.create({
        name,
        category: form.category || undefined,
        description: form.description.trim() || undefined,
      });
      setCompanies((current) => [...(current ?? []), company]);
      setForm({ name: "", category: "", description: "" });
      setCreating(false);
      toast.success(`${company.name} is ready. Switch to set it up.`);
    } catch {
      // The axios interceptor surfaces the exact server message.
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCategory() {
    const name = categoryName.trim();
    if (name.length < 2) return;
    setSaving(true);
    try {
      const category = await CompanyService.createCategory(name);
      setCategories((current) => [...current.filter((item) => item.name.toLowerCase() !== category.name.toLowerCase()), category].sort((left, right) => left.name.localeCompare(right.name)));
      setForm((current) => ({ ...current, category: category.name }));
      setCategoryName("");
      setCreatingCategory(false);
      toast.success(`${category.name} category added.`);
    } catch {
      // The axios interceptor surfaces the exact server message.
    } finally {
      setSaving(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close companies panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Switch company"
        data-theme={theme}
        className={`${styles.drawer} relative flex h-full w-full max-w-sm flex-col border-l border-(--brand-border) bg-white shadow-(--shadow-lg) motion-safe:animate-[companyDrawerIn_180ms_ease-out]`}
      >
        <style>{"@keyframes companyDrawerIn{from{transform:translateX(24px);opacity:.4}to{transform:translateX(0);opacity:1}}"}</style>
        <div className="flex items-start justify-between gap-3 border-b border-(--brand-border) p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--brand-navy) text-sm font-semibold text-white">
              {user.user_name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-(--brand-text)">{user.user_name}</p>
              <p className="truncate text-xs text-(--brand-text-muted)">{user.user_email}</p>
              {user.organization_title ? (
                <p className="truncate text-xs font-semibold text-[#008f69]">{user.organization_title}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-(--brand-text-muted) hover:bg-(--brand-surface-hover)"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-(--brand-text-muted)">Companies</h2>
            {canCreateCompany ? <button
              type="button"
              onClick={() => setCreating((value) => !value)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-(--brand-navy) hover:bg-(--brand-surface-hover)"
            >
              <Plus size={14} /> Add company
            </button> : null}
          </div>

          {creating && canCreateCompany ? (
            <form onSubmit={handleCreate} className="mt-3 space-y-2 rounded-(--radius-lg) border border-(--brand-border) p-3">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Company name"
                required
                minLength={2}
                maxLength={120}
                className="w-full rounded-md border border-(--brand-border) px-3 py-2 text-sm outline-none focus:border-(--brand-navy)"
              />
              <div className="flex gap-2">
                <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="min-w-0 flex-1 rounded-md border border-(--brand-border) bg-white px-3 py-2 text-sm outline-none focus:border-(--brand-navy)">
                  <option value="">Select a category</option>
                  {categories.map((category) => <option key={category.id ?? category.name} value={category.name}>{category.name}</option>)}
                </select>
                <button type="button" onClick={() => setCreatingCategory((value) => !value)} aria-label="Add company category" title="Add category" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-(--brand-border) text-(--brand-navy) hover:bg-(--brand-surface-hover)"><Plus size={16} /></button>
              </div>
              {creatingCategory ? <div className="flex gap-2" aria-label="Create company category">
                <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category" minLength={2} maxLength={80} required className="min-w-0 flex-1 rounded-md border border-(--brand-border) px-3 py-2 text-sm outline-none focus:border-(--brand-navy)" />
                <button type="button" onClick={() => void handleCreateCategory()} disabled={saving || categoryName.trim().length < 2} className="rounded-md bg-(--brand-navy) px-3 text-xs font-semibold text-white disabled:opacity-60">Add</button>
              </div> : null}
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Short description (optional)"
                maxLength={500}
                rows={2}
                className="w-full resize-none rounded-md border border-(--brand-border) px-3 py-2 text-sm outline-none focus:border-(--brand-navy)"
              />
              <p className="text-xs text-(--brand-text-muted)">
                A new company starts empty with the same features and its own people, products, tasks and chats.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-(--brand-text-muted) hover:bg-(--brand-surface-hover)"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.category}
                  className="flex items-center gap-2 rounded-md bg-(--brand-navy) px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null} Create
                </button>
              </div>
            </form>
          ) : null}

          <label className="mt-3 flex h-10 items-center gap-2 rounded-md border border-(--brand-border) bg-white px-3">
            <Search size={15} className="shrink-0 text-(--brand-text-muted)" />
            <input aria-label="Search accessible companies by name or category" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search company or category" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>

          <ul className="mt-3 space-y-2">
            {companies === null && !loadError
              ? Array.from({ length: 2 }).map((_, index) => (
                  <li key={index} className="h-[72px] animate-pulse rounded-(--radius-lg) bg-(--brand-surface-hover)" />
                ))
              : null}
            {loadError ? (
              <li className="rounded-(--radius-lg) border border-(--brand-border) p-3 text-sm text-(--brand-text-muted)">
                Could not load companies.{" "}
                <button type="button" onClick={() => void load()} className="font-semibold text-(--brand-navy) underline">
                  Retry
                </button>
              </li>
            ) : null}
            {companies?.map((company) => {
              const active = company.id === activeId;
              return (
                <li key={company.id}>
                  <button
                    type="button"
                    onClick={() => switchTo(company)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-(--radius-lg) border p-3 text-left transition ${
                      active
                        ? "border-(--brand-navy) bg-(--brand-surface-hover)"
                        : "border-(--brand-border) hover:border-(--brand-navy) hover:bg-(--brand-surface-hover)"
                    }`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-lg) bg-(--brand-navy)/10 text-(--brand-navy)">
                      <Building2 size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-(--brand-text)">{company.name}</span>
                        {company.is_default ? (
                          <span className="rounded-full bg-(--brand-surface-hover) px-2 py-0.5 text-[10px] font-semibold uppercase text-(--brand-text-muted)">
                            Group
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-(--brand-text-muted)">
                        {company.category || company.industry || "No category"} · {company.stats.members} members · {company.stats.products} products
                      </span>
                    </span>
                    {switchingId === company.id ? (
                      <Loader2 size={16} className="shrink-0 animate-spin text-(--brand-navy)" />
                    ) : active ? (
                      <Check size={16} className="shrink-0 text-(--brand-navy)" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-(--brand-border) p-2">
          {accountLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={hrefFor(href)}
              onClick={onClose}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--brand-text) hover:bg-(--brand-surface-hover)"
            >
              <Icon size={16} /> {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-(--status-danger) hover:bg-(--status-danger-bg)"
          >
            <LogOut size={16} /> Log out
          </button>
        </div>

        {switchingId ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 text-sm font-medium text-(--brand-text)">
            <Loader2 size={22} className="animate-spin text-(--brand-navy)" />
            Switching to {companies?.find((company) => company.id === switchingId)?.name}…
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
