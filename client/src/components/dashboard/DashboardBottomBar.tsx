"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CircleHelp,
  MessageCircle,
  NotebookPen,
  Pin,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardHelpDialog } from "./DashboardHelpDialog";
import { departmentHref } from "@/lib/dashboard/departments";
import { visibleNavGroups } from "@/lib/dashboard/navigation";
import styles from "./DashboardBottomBar.module.css";

type Panel = "pins" | "search" | null;

type DashboardBottomBarProps = {
  userId: string;
  roles: string[];
  systemRoles: string[];
  department?: string | null;
  designation?: string | null;
  permissions: string[];
  canViewCompanyAdminPages: boolean;
};

export function DashboardBottomBar({
  userId,
  roles,
  systemRoles,
  department,
  designation,
  permissions,
  canViewCompanyAdminPages,
}: DashboardBottomBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [panel, setPanel] = useState<Panel>(null);
  const [search, setSearch] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const storageKey = `ricoz-dashboard-pins:${userId}`;
  const [pins, setPins] = useState<string[]>(() => loadPins(storageKey));
  const executive = roles.includes("CEO") || roles.includes("ADMIN");
  const pages = useMemo(
    () =>
      visibleNavGroups(
        roles,
        department,
        designation,
        systemRoles,
        permissions,
        canViewCompanyAdminPages,
      ).flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          group: group.label,
        destination: dashboardHref(item.href, executive, department),
        })),
      ),
    [
      roles,
      department,
      designation,
      systemRoles,
      permissions,
      canViewCompanyAdminPages,
      executive,
    ],
  );
  const pageById = useMemo(() => new Map(pages.map((page) => [page.href, page])), [pages]);
  const query = search.trim().toLowerCase();
  const searchResults = pages.filter((page) =>
    `${page.group} ${page.label}`.toLowerCase().includes(query),
  );
  const pinnedPages = pins.flatMap((href) => {
    const page = pageById.get(href);
    return page ? [page] : [];
  });
  const filteredPins = pinnedPages.filter((page) =>
    `${page.group} ${page.label}`.toLowerCase().includes(query),
  );
  const pagesToPin = searchResults.filter((page) => !pins.includes(page.href));
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pins));
    } catch (error) {
      console.error("Dashboard pins could not be saved.", error);
      toast.error("Pinned pages could not be saved in this browser.");
    }
  }, [pins, storageKey]);

  const togglePin = (href: string) =>
    setPins((current) =>
      current.includes(href)
        ? current.filter((item) => item !== href)
        : [...current, href],
    );
  const closePanel = () => {
    setPanel(null);
    setSearch("");
  };
  const messagesHref = dashboardHref("/dashboard/messages", executive, department);
  const contactsHref = `${messagesHref}${messagesHref.includes("?") ? "&" : "?"}view=chats&contacts=1`;
  const todoHref = dashboardHref("/dashboard/my-work/todo", executive, executive ? "PERSONAL" : department);
  const pathMatches = (href: string) => pathname === href.split("?")[0];
  const contactsActive = pathname === "/dashboard/messages" && searchParams.get("contacts") === "1";
  const renderPage = (page: (typeof pages)[number], canTogglePin: boolean) => {
    const Icon = page.icon;
    const pinned = pins.includes(page.href);
    return (
      <div className={styles.result} key={`${page.group}:${page.href}`}>
        <Link href={page.destination} onClick={closePanel} className={styles.pageLink}>
          <Icon size={15} aria-hidden="true" />
          <span><strong>{page.label}</strong><small>{page.group || "Dashboard"}</small></span>
        </Link>
        {canTogglePin ? (
          <button
            type="button"
            className={`${styles.pinButton} ${pinned ? styles.pinned : ""}`}
            onClick={() => togglePin(page.href)}
            aria-label={`${pinned ? "Unpin" : "Pin"} ${page.label}`}
            title={pinned ? "Unpin page" : "Pin page"}
          >
            <Pin size={15} fill={pinned ? "currentColor" : "none"} />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <>
    <nav className={styles.bar} aria-label="Dashboard shortcuts">
      {panel ? (
        <section
          className={`${styles.panel} ${panel === "search" ? styles.searchPanel : ""}`}
          aria-label={panel === "pins" ? "My pinned pages" : "Search dashboard pages"}
        >
          <header className={styles.panelHeader}>
            <div>
              <strong>{panel === "pins" ? "My Pins" : "Search pages"}</strong>
              <span>{panel === "pins" ? "Your saved dashboard pages" : "Find a page you can access"}</span>
            </div>
            <button type="button" aria-label="Close panel" onClick={closePanel} className={styles.closeButton}>
              <X size={16} />
            </button>
          </header>
          <label className={styles.searchInput}>
            <Search size={15} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={panel === "pins" ? "Find a page to pin" : "Search dashboard pages"}
              aria-label={panel === "pins" ? "Find a page to pin" : "Search dashboard pages"}
            />
          </label>
          <div className={styles.results}>
            {panel === "pins" ? (
              <>
                <span className={styles.sectionLabel}>Pinned pages</span>
                {filteredPins.map((page) => renderPage(page, true))}
                {!filteredPins.length ? <p className={styles.empty}>No pinned pages yet.</p> : null}
                <span className={styles.sectionLabel}>Pin a dashboard page</span>
                {pagesToPin.map((page) => renderPage(page, true))}
                {!pagesToPin.length && filteredPins.length ? <p className={styles.empty}>All matching pages are pinned.</p> : null}
              </>
            ) : (
              <>
                {searchResults.map((page) => renderPage(page, false))}
                {!searchResults.length ? <p className={styles.empty}>No pages match your search.</p> : null}
              </>
            )}
          </div>
        </section>
      ) : null}

      <div className={styles.leftItems}>
        <button
          type="button"
          className={`${styles.item} ${panel === "pins" ? styles.selected : ""}`}
          aria-expanded={panel === "pins"}
          onClick={() => setPanel((current) => current === "pins" ? null : "pins")}
        >
          <span className={styles.icon}><Pin size={15} fill={panel === "pins" ? "currentColor" : "none"} /></span>
          <span className={styles.label}>My Pins</span>
          {pins.length > 0 ? <span className={styles.pinCount}>{pins.length}</span> : null}
        </button>
        <Link href={messagesHref} className={`${styles.item} ${pathMatches(messagesHref) ? styles.selected : ""}`}>
          <span className={styles.icon}><MessageCircle size={15} /></span>
          <span className={styles.label}>Chats</span>
        </Link>
        <Link href={contactsHref} className={`${styles.item} ${contactsActive ? styles.selected : ""}`}>
          <span className={styles.icon}><UsersRound size={15} /></span>
          <span className={styles.label}>Contacts</span>
        </Link>
      </div>

      <div className={styles.rightItems}>
        <button type="button" onClick={() => setHelpOpen(true)} className={styles.help} aria-label="Need help? Contact support">
          <CircleHelp size={16} />
          <span className={styles.helpLabel}>Need Help?</span>
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Search dashboard pages"
          aria-expanded={panel === "search"}
          onClick={() => setPanel((current) => current === "search" ? null : "search")}
        >
          <Search size={18} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <Link href={todoHref} className={styles.iconButton} aria-label="My Work TODO" title="My Work TODO">
          <NotebookPen size={17} />
        </Link>
      </div>
    </nav>
    {helpOpen ? <DashboardHelpDialog onClose={() => setHelpOpen(false)} /> : null}
    </>
  );
}

function dashboardHref(href: string, executive: boolean, department?: string | null) {
  if (!executive) return href;
  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  const targetDepartment = params.get("department") ?? department ?? "PRODUCT";
  params.set("department", targetDepartment);
  return departmentHref(pathname, targetDepartment) +
    (params.size > 1 ? `&${[...params].filter(([key]) => key !== "department").map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}` : "");
}

function loadPins(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(storageKey);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed) || !parsed.every((value: unknown): value is string => typeof value === "string")) {
      throw new TypeError("Stored dashboard pins have an invalid format.");
    }
    return [...new Set(parsed)];
  } catch (error) {
    console.error("Dashboard pins could not be loaded.", error);
    return [];
  }
}
