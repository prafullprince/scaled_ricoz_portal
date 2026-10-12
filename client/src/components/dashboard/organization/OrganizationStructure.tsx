"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  GripVertical,
  IdCard,
  ListTree,
  LoaderCircle,
  Maximize2,
  Minus,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  OrganizationService,
  type OrganizationAssignment,
  type OrganizationRoleCatalog,
  type OrganizationUser,
} from "@/services/organization.service";
import { CompanyService, type Company } from "@/services/company.service";
import { useAppSelector } from "@/redux/hooks";
import { USER_ROLES } from "@/lib/auth/roles";
import { ManagerTeamMemberDialog } from "../ManagerTeamMemberDialog";
import { OrganizationRemovalDialog } from "../OrganizationRemovalDialog";
import { UserProfileDialog } from "../UserProfileDialog";
import { CompanyOrganizationRemovalDialog } from "./CompanyOrganizationRemovalDialog";
import { OrganizationRoleManager } from "./OrganizationRoleManager";
import styles from "./OrganizationStructure.module.css";

type Level = OrganizationAssignment["level"];
type MemberRole = "INTERN" | "EMPLOYEE";
type Editor =
  | {
      mode: "add";
      companyId: string;
      parent: OrganizationAssignment | null;
      user?: OrganizationUser;
    }
  | {
      mode: "edit";
      companyId: string;
      node: OrganizationAssignment;
    };
type Removal = { companyId: string; assignment: OrganizationAssignment };

const ROOT = "__root__";
const FALLBACK_COMPANY_NAME = "First Ricoz Private Limited";
const DEPARTMENTS = [
  "PRODUCT",
  "MARKETING",
  "FINANCE",
  "SALES",
  "PROJECTS",
  "SUPPORT",
  "HR",
  "DESIGN",
  "ENGINEERING",
];
const NEXT_LEVEL: Record<Level, Level | null> = {
  CEO: "HEAD",
  HR: "HEAD",
  HEAD: "MANAGER",
  MANAGER: "MEMBER",
  MEMBER: null,
};
const PREVIOUS_LEVEL: Partial<Record<Level, Level>> = {
  HR: "CEO",
  MANAGER: "HEAD",
  MEMBER: "MANAGER",
};
const LEVEL_LABEL: Record<Level, string> = {
  CEO: "CEO",
  HR: "HR Administrator",
  HEAD: "Department Head",
  MANAGER: "Manager",
  MEMBER: "Member",
};
const BASE_ROLES = new Set<string>([
  USER_ROLES.USER,
  USER_ROLES.INTERN,
  USER_ROLES.EMPLOYEE,
]);
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.2;
const COMPANY_TONES = ["blue", "teal", "violet", "amber", "rose", "cyan"] as const;

const titleCase = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase();
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
const companyTone = (id: string) => {
  const hash = [...id].reduce((value, character) => value + character.charCodeAt(0), 0);
  return COMPANY_TONES[hash % COMPANY_TONES.length];
};
const memberRoleFor = (roles: string[]): MemberRole =>
  roles.includes(USER_ROLES.EMPLOYEE) ? "EMPLOYEE" : "INTERN";
const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

function roleTitle(item: OrganizationAssignment) {
  const department = titleCase(item.department);
  if (item.level === "CEO") return "Chief Executive Officer";
  if (item.level === "HR") return "HR Administrator";
  if (item.level === "HEAD") return `Head of ${department}`;
  if (item.level === "MANAGER") return `${department} Manager`;
  const memberRole =
    item.employmentType ??
    (item.roleKeys.includes(USER_ROLES.EMPLOYEE)
      ? "EMPLOYEE"
      : memberRoleFor(item.userId.roles));
  return `${department} ${memberRole === "EMPLOYEE" ? "Employee" : "Intern"}`;
}

function hierarchyRoleKey(
  level: Level,
  department: string,
  memberRole: MemberRole,
) {
  if (level === "CEO") return USER_ROLES.CEO;
  if (level === "HR") return "HR";
  if (level === "HEAD") return `${department}_HEAD`;
  if (level === "MANAGER") return `${department}_MANAGER`;
  return memberRole;
}

function customRoleHierarchyLevel(
  role: OrganizationRoleCatalog["customRoles"][number],
): Level | null {
  if (role.hierarchyLevel) return role.hierarchyLevel;
  const levels = new Set<Level>();
  for (const binding of role.roleBindings) {
    if (binding === "HEAD" || binding.endsWith("_HEAD")) levels.add("HEAD");
    else if (binding === "MANAGER" || binding.endsWith("_MANAGER"))
      levels.add("MANAGER");
    else if (binding === "INTERN" || binding === "EMPLOYEE")
      levels.add("MEMBER");
  }
  return levels.size === 1 ? [...levels][0] : null;
}

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia("(max-width: 767px)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type TreeContext = {
  companyId: string;
  items: OrganizationAssignment[];
  childrenOf: Map<string, OrganizationAssignment[]>;
  collapsed: Set<string>;
  matches: Set<string>;
  linkedCompaniesByParent: Map<string, Company[]>;
  companyContexts: Map<string, TreeContext>;
  canLinkCompany: () => boolean;
  myId?: string;
  draggedUserId?: string | null;
  toggle: (id: string) => void;
  canAdd: (item: OrganizationAssignment) => boolean;
  canEdit: (item: OrganizationAssignment) => boolean;
  canMove: (item: OrganizationAssignment) => boolean;
  canDrop: (
    source: OrganizationAssignment,
    target: OrganizationAssignment,
  ) => boolean;
  hasReports: (item: OrganizationAssignment) => boolean;
  roleLabel: (key: string) => string;
  onAdd: (item: OrganizationAssignment, companyId: string) => void;
  onAddTop: (companyId: string) => void;
  onEdit: (item: OrganizationAssignment, companyId: string) => void;
  onDragStart: (userId: string) => void;
  onDragEnd: () => void;
  onMove: (
    source: OrganizationAssignment,
    target: OrganizationAssignment,
    companyId: string,
  ) => void;
  onRemove: (item: OrganizationAssignment, companyId: string) => void;
  onOpen: (item: OrganizationAssignment, companyId: string) => void;
  onLinkCompany: (item: OrganizationAssignment, companyId: string) => void;
  onUnlinkCompany: (company: Company) => void;
  onManageRoles: (companyId: string) => void;
  onApplyCompanyAccess: (
    company: Company,
    source: OrganizationAssignment,
  ) => void;
};

export function OrganizationView() {
  const searchParams = useSearchParams();
  const editUserId = searchParams.get("editUserId");
  const me = useAppSelector((state) => state.auth.user);
  const roles = useMemo(() => me?.roles ?? [], [me?.roles]);
  const myId = me?.user_id;
  const isExecutive =
    roles.includes(USER_ROLES.ADMIN) || roles.includes(USER_ROLES.CEO);
  const canAssignHrLevel =
    isExecutive ||
    (roles.includes("HR") &&
      me?.organization_level === "HR" &&
      me?.organization_department === "HR");
  const isSystemHr =
    roles.includes("HR") &&
    (Boolean(me?.system_roles?.includes("HR")) ||
      me?.organization_level === "HR");
  const isHead = roles.some(
    (role) => role === USER_ROLES.HEAD || role.endsWith("_HEAD"),
  );
  const isManager = roles.some(
    (role) => role === USER_ROLES.MANAGER || role.endsWith("_MANAGER"),
  );
  const isHr =
    !isExecutive &&
    (isSystemHr ||
      (me?.organization_department === "HR" &&
        (me?.organization_level === "HR" || isHead || isManager)));
  const structureAdmin = isExecutive || isHr;
  const myDepartment = me?.organization_department ?? "PRODUCT";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    () => me?.company?.id ?? "",
  );
  const managementCompanyId = selectedCompanyId || me?.company?.id || "";
  const selectedCompanyName =
    companies.find((company) => company.id === managementCompanyId)?.name ??
    me?.company?.name ??
    FALLBACK_COMPANY_NAME;
  const [items, setItems] = useState<OrganizationAssignment[]>([]);
  const [linkedItems, setLinkedItems] = useState<
    Map<string, OrganizationAssignment[]>
  >(() => new Map());
  const [linkedRevision, setLinkedRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [query, setQuery] = useState("");
  const [chosenView, setChosenView] = useState<"chart" | "outline" | null>(
    null,
  );
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);
  const [movingUserIds, setMovingUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [companyCollapsed, setCompanyCollapsed] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [roleCatalog, setRoleCatalog] =
    useState<OrganizationRoleCatalog | null>(null);
  const [linkedRoleCatalogs, setLinkedRoleCatalogs] = useState<
    Map<string, OrganizationRoleCatalog>
  >(() => new Map());
  const [manageRoles, setManageRoles] = useState(false);
  const [manageRoleCompanyId, setManageRoleCompanyId] = useState("");
  const [removing, setRemoving] = useState<Removal | null>(null);
  const [unlinkingCompany, setUnlinkingCompany] = useState<Company | null>(
    null,
  );
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileCompanyId, setProfileCompanyId] = useState<string | undefined>();
  const [linking, setLinking] = useState<{
    parent: OrganizationAssignment;
    parentCompanyId: string;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLDivElement>(null);
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
  const view = chosenView ?? (narrow ? "outline" : "chart");

  useEffect(() => {
    if (!isExecutive) return;
    let active = true;
    CompanyService.list()
      .then((availableCompanies) => {
        if (active) setCompanies(availableCompanies);
      })
      .catch((error: unknown) => {
        if (active) toast.error(errorText(error, "Companies could not be loaded."));
      });
    return () => {
      active = false;
    };
  }, [isExecutive]);

  const descendantCompanies = useMemo(() => {
    const descendants: Company[] = [];
    const visited = new Set<string>([managementCompanyId]);
    let parentIds = new Set([managementCompanyId]);
    while (parentIds.size) {
      const children = companies.filter(
        (company) =>
          company.organization_parent_company_id &&
          parentIds.has(company.organization_parent_company_id) &&
          !visited.has(company.id),
      );
      parentIds = new Set(children.map((company) => company.id));
      for (const child of children) {
        visited.add(child.id);
        descendants.push(child);
      }
    }
    return descendants;
  }, [companies, managementCompanyId]);

  useEffect(() => {
    if (!isExecutive) return;
    let active = true;
    Promise.all(
      descendantCompanies.map(async (company) => {
        const [companyItems, catalog] = await Promise.all([
          OrganizationService.list(company.id),
          OrganizationService.roles(company.id),
        ]);
        return [company.id, companyItems, catalog] as const;
      }),
    )
      .then((results) => {
        if (!active) return;
        setLinkedItems(new Map(results.map(([id, entries]) => [id, entries])));
        setLinkedRoleCatalogs(
          new Map(results.map(([id, , catalog]) => [id, catalog])),
        );
      })
      .catch((error: unknown) => {
        if (active)
          toast.error(errorText(error, "Linked company structures could not be loaded."));
      });
    return () => {
      active = false;
    };
  }, [descendantCompanies, isExecutive, linkedRevision]);

  useEffect(() => {
    if (!structureAdmin) return;
    let active = true;
    OrganizationService.roles(managementCompanyId)
      .then((catalog) => {
        if (active) setRoleCatalog(catalog);
      })
      .catch(() => {
        if (active) setRoleCatalog(null);
      });
    return () => {
      active = false;
    };
  }, [managementCompanyId, structureAdmin]);

  const load = useCallback(async () => {
    try {
      setItems(await OrganizationService.list(managementCompanyId));
      setLoadError("");
    } catch (error) {
      setLoadError(errorText(error, "The organization could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, [managementCompanyId]);

  useEffect(() => {
    let active = true;
    OrganizationService.list(managementCompanyId)
      .then(async (result) => {
        if (!active) return;
        setItems(result);
        setLoadError("");
        if (!editUserId || !structureAdmin) return;
        const target = result.find((item) => item.userId._id === editUserId);
        if (target)
          setEditor({
            mode: "edit",
            companyId: managementCompanyId,
            node: target,
          });
        else {
          const profile = await OrganizationService.profile(editUserId, managementCompanyId);
          if (active)
            setEditor({
              mode: "add",
              companyId: managementCompanyId,
              parent: null,
              user: {
                _id: profile._id,
                name: profile.name,
                email: profile.email,
                roles: profile.roles,
              },
            });
        }
      })
      .catch((error) => {
        if (active)
          setLoadError(
            errorText(error, "The organization could not be loaded."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [editUserId, managementCompanyId, structureAdmin]);

  useLayoutEffect(() => {
    if (loading || view !== "chart") return;
    const viewport = viewportRef.current;
    const company = companyRef.current;
    if (!viewport || !company) return;
    const box = viewport.getBoundingClientRect();
    const target = company.getBoundingClientRect();
    viewport.scrollLeft +=
      target.left + target.width / 2 - (box.left + box.width / 2);
  }, [loading, view]);

  const fullChildren = useMemo(() => {
    const ids = new Set(items.map((item) => item.userId._id));
    const grouped = new Map<string, OrganizationAssignment[]>();
    for (const item of items) {
      const parent =
        item.reportsTo?._id &&
        ids.has(item.reportsTo._id) &&
        item.reportsTo._id !== item.userId._id
          ? item.reportsTo._id
          : ROOT;
      grouped.set(parent, [...(grouped.get(parent) ?? []), item]);
    }
    const order: Record<Level, number> = {
      CEO: 0,
      HR: 1,
      HEAD: 2,
      MANAGER: 3,
      MEMBER: 4,
    };
    for (const children of grouped.values())
      children.sort(
        (a, b) =>
          order[a.level] - order[b.level] ||
          a.department.localeCompare(b.department) ||
          a.userId.name.localeCompare(b.userId.name),
      );
    return grouped;
  }, [items]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return new Set<string>();
    return new Set(
      items
        .filter((item) =>
          `${item.userId.name} ${item.userId.email} ${roleTitle(item)}`
            .toLowerCase()
            .includes(term),
        )
        .map((item) => item.userId._id),
    );
  }, [items, query]);

  const visibleChildren = useMemo(() => {
    const filtering = department !== "ALL" || query.trim();
    if (!filtering) return fullChildren;
    const byId = new Map(items.map((item) => [item.userId._id, item]));
    const seeds = items.filter(
      (item) =>
        (department === "ALL" || item.department === department) &&
        (!query.trim() || matches.has(item.userId._id)),
    );
    const keep = new Set<string>();
    for (const seed of seeds) {
      let current: OrganizationAssignment | undefined = seed;
      while (current && !keep.has(current.userId._id)) {
        keep.add(current.userId._id);
        current = current.reportsTo?._id
          ? byId.get(current.reportsTo._id)
          : undefined;
      }
    }
    const grouped = new Map<string, OrganizationAssignment[]>();
    for (const [parent, children] of fullChildren) {
      const kept = children.filter((child) => keep.has(child.userId._id));
      if (kept.length) grouped.set(parent, kept);
    }
    return grouped;
  }, [department, fullChildren, items, matches, query]);

  const isProtected = useCallback(
    (item: OrganizationAssignment) =>
      (item.level === "CEO" && !isSystemHr) ||
      (item.level === "HR" && !isSystemHr) ||
      item.userId.roles.includes(USER_ROLES.ADMIN),
    [isSystemHr],
  );
  const canEdit = useCallback(
    (item: OrganizationAssignment) => {
      if (item.userId._id === myId) return isExecutive;
      if (isExecutive) return true;
      if (isHr) return !isProtected(item);
      return (
        (isHead &&
          item.level === "MEMBER" &&
          item.department === myDepartment) ||
        (item.reportsTo?._id === myId &&
          ((isHead && item.level === "MANAGER") ||
            (isManager && item.level === "MEMBER")))
      );
    },
    [isExecutive, isHead, isHr, isManager, isProtected, myId, myDepartment],
  );
  const canAdd = useCallback(
    (item: OrganizationAssignment) =>
      isExecutive ||
      (structureAdmin && Boolean(NEXT_LEVEL[item.level])) ||
      (item.userId._id === myId &&
        ((isHead && item.level === "HEAD") ||
          (isManager && item.level === "MANAGER"))),
    [isExecutive, structureAdmin, myId, isHead, isManager],
  );
  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function upsert(assignment: OrganizationAssignment, companyId: string) {
    const update = (current: OrganizationAssignment[]) =>
      current.some((item) => item.userId._id === assignment.userId._id)
        ? current.map((item) =>
            item.userId._id === assignment.userId._id ? assignment : item,
          )
        : [...current, assignment];
    if (companyId === managementCompanyId) setItems(update);
    else
      setLinkedItems((current) =>
        new Map(current).set(companyId, update(current.get(companyId) ?? [])),
      );
  }

  async function moveAssignment(
    source: OrganizationAssignment,
    target: OrganizationAssignment,
    companyId: string,
  ) {
    if (movingUserIds.has(source.userId._id)) return;
    setMovingUserIds((current) => new Set(current).add(source.userId._id));
    try {
      const nextLevel = NEXT_LEVEL[target.level];
      if (!nextLevel) return;
      const memberRole: MemberRole =
        source.level === "MEMBER"
          ? source.employmentType ??
            (source.roleKeys.includes(USER_ROLES.EMPLOYEE)
              ? "EMPLOYEE"
              : memberRoleFor(source.userId.roles))
          : source.userId.roles.includes(USER_ROLES.INTERN)
            ? "INTERN"
            : "EMPLOYEE";
      const oldHierarchyRole = hierarchyRoleKey(
        source.level,
        source.department,
        memberRole,
      );
      const nextHierarchyRole = hierarchyRoleKey(
        nextLevel,
        source.department,
        memberRole,
      );
      const catalog =
        companyId === managementCompanyId
          ? roleCatalog
          : linkedRoleCatalogs.get(companyId);
      const roleKeys = source.roleKeys.filter((key) => {
        if (key === oldHierarchyRole) return false;
        const customRole = catalog?.customRoles.find((role) => role.key === key);
        const customLevel = customRole
          ? customRoleHierarchyLevel(customRole)
          : null;
        return !customLevel || customLevel === nextLevel;
      });
      const assignment = await OrganizationService.assign(
        {
          userId: source.userId._id,
          level: nextLevel,
          department: source.department,
          memberRole: nextLevel === "MEMBER" ? memberRole : undefined,
          roleKeys: [...new Set([...roleKeys, nextHierarchyRole])],
          allCompanyAccess: source.allCompanyAccess,
          reportsTo: target.userId._id,
        },
        companyId,
      );
      upsert(assignment, companyId);
      toast.success(
        `${source.userId.name} is now ${roleTitle(assignment)} under ${target.userId.name}.`,
      );
      if (companyId === managementCompanyId) void load();
      else setLinkedRevision((revision) => revision + 1);
    } catch (error) {
      toast.error(errorText(error, "The reporting line could not be changed."));
    } finally {
      setMovingUserIds((current) => {
        const next = new Set(current);
        next.delete(source.userId._id);
        return next;
      });
      setDraggedUserId(null);
    }
  }

  function fitToScreen() {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;
    const natural = canvas.getBoundingClientRect().width / zoom;
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, (viewport.clientWidth - 8) / natural),
    );
    setZoom(Math.floor(next * 20) / 20);
    viewport.scrollTo({ left: 0, top: 0 });
  }

  const companyItems = new Map<string, OrganizationAssignment[]>([
    [managementCompanyId, items],
    ...linkedItems,
  ]);
  const linkedCompaniesByParent = new Map<string, Company[]>();
  for (const company of descendantCompanies) {
    if (!company.organization_parent_company_id || !company.organization_anchor_user_id)
      continue;
    const key = `${company.organization_parent_company_id}:${company.organization_anchor_user_id}`;
    linkedCompaniesByParent.set(key, [
      ...(linkedCompaniesByParent.get(key) ?? []),
      company,
    ]);
  }
  const companyContexts = new Map<string, TreeContext>();
  const buildChildrenForCompany = (companyItems: OrganizationAssignment[]) => {
    const ids = new Set(companyItems.map((item) => item.userId._id));
    const grouped = new Map<string, OrganizationAssignment[]>();
    for (const item of companyItems) {
      const parent =
        item.reportsTo?._id &&
        ids.has(item.reportsTo._id) &&
        item.reportsTo._id !== item.userId._id
          ? item.reportsTo._id
          : ROOT;
      grouped.set(parent, [...(grouped.get(parent) ?? []), item]);
    }
    return grouped;
  };
  const assignCompanyAnchorRole = async (
    companyId: string,
    source: OrganizationAssignment,
    parentCompanyId?: string,
  ) => {
    const assignments = await OrganizationService.list(companyId);
    const existing = assignments.find(
      (assignment) => assignment.userId._id === source.userId._id,
    );
    const level: Level = existing?.level ?? "HEAD";
    const department = existing?.department ?? "PROJECTS";
    const memberRole =
      existing?.employmentType ??
      (existing?.roleKeys.includes(USER_ROLES.EMPLOYEE) ? "EMPLOYEE" : "INTERN");
    const roleKeys = existing?.roleKeys.length
      ? existing.roleKeys
      : [hierarchyRoleKey(level, department, memberRole)];
    const assignment = await OrganizationService.assign(
      {
        userId: source.userId._id,
        level,
        department,
        memberRole: level === "MEMBER" ? memberRole : undefined,
        roleKeys,
        allCompanyAccess: true,
        reportsTo: existing?.reportsTo?._id,
      },
      companyId,
    );
    setLinkedItems((current) => {
      const companyAssignments = current.get(companyId) ?? assignments;
      return new Map(current).set(
        companyId,
        existing
          ? companyAssignments.map((item) =>
              item.userId._id === assignment.userId._id ? assignment : item,
            )
          : [...companyAssignments, assignment],
      );
    });
    setLinkedRevision((revision) => revision + 1);
    if (parentCompanyId) {
      try {
        await CompanyService.setOrganizationParent(
          companyId,
          parentCompanyId,
          source.userId._id,
        );
      } catch (error) {
        throw new Error(
          `Their role and full access were assigned, but the company could not be linked: ${errorText(error, "the hierarchy link failed.")}`,
        );
      }
      try {
        setCompanies(await CompanyService.list());
      } catch (error) {
        throw new Error(
          `Their role and full access were assigned and the company was linked, but the company list could not be refreshed: ${errorText(error, "the refresh failed.")}`,
        );
      }
    }
    toast.success(
      `${source.userId.name} ${existing ? "kept their company role" : "was assigned as Projects Head"} with full access in ${companies.find((company) => company.id === companyId)?.name ?? "the company"}.`,
    );
  };
  const createCompanyContext = (
    companyId: string,
    orgItems: OrganizationAssignment[],
    childrenOf: Map<string, OrganizationAssignment[]>,
  ): TreeContext => {
    const catalog =
      companyId === managementCompanyId
        ? roleCatalog
        : linkedRoleCatalogs.get(companyId) ?? null;
    const isRootCompany = companyId === managementCompanyId;
    const companyMatches = isRootCompany
      ? matches
      : query.trim()
        ? new Set(
            orgItems
              .filter((item) =>
                `${item.userId.name} ${item.userId.email} ${roleTitle(item)}`
                  .toLowerCase()
                  .includes(query.trim().toLowerCase()),
              )
              .map((item) => item.userId._id),
          )
        : new Set<string>();
    return {
      companyId,
      items: orgItems,
      childrenOf,
      collapsed:
        isRootCompany && query.trim()
          ? new Set<string>()
          : collapsed,
      matches: companyMatches,
      linkedCompaniesByParent,
      companyContexts,
      canLinkCompany: () => isExecutive,
      myId,
      draggedUserId,
      toggle: (id) => toggle(isRootCompany ? id : `${companyId}:${id}`),
      canAdd: (item) =>
        isRootCompany
          ? canAdd(item)
          : isExecutive && Boolean(NEXT_LEVEL[item.level]),
      canEdit: (item) => (isRootCompany ? canEdit(item) : isExecutive),
      canMove: (item) =>
        (isRootCompany ? canEdit(item) : isExecutive) &&
        ["MANAGER", "MEMBER"].includes(item.level),
      canDrop: (source, target) => {
        const nextLevel = NEXT_LEVEL[target.level];
        if (
          source.userId._id === target.userId._id ||
          !nextLevel ||
          target.level === "HR" ||
          (target.level !== "CEO" && source.department !== target.department) ||
          (source.level === nextLevel &&
            source.reportsTo?._id === target.userId._id) ||
          (source.level !== nextLevel &&
            Boolean(childrenOf.get(source.userId._id)?.length))
        )
          return false;
        if (isExecutive || (isRootCompany && structureAdmin)) return true;
        if (
          isRootCompany &&
          isHead &&
          (source.level === "MANAGER" || source.level === "MEMBER") &&
          (nextLevel === "MANAGER" || nextLevel === "MEMBER")
        )
          return true;
        return (
          isRootCompany &&
          isManager &&
          source.level === "MEMBER" &&
          nextLevel === "MEMBER" &&
          target.userId._id === myId
        );
      },
      hasReports: (item) => Boolean(childrenOf.get(item.userId._id)?.length),
      roleLabel: (key) => {
        const custom = catalog?.customRoles.find((role) => role.key === key);
        if (custom) return custom.name;
        return key
          .replace(/^custom:/, "")
          .replaceAll("_", " ")
          .toLowerCase()
          .replace(/\b\w/g, (letter) => letter.toUpperCase());
      },
      onAdd: (item, targetCompanyId) =>
        setEditor({
          mode: "add",
          companyId: targetCompanyId,
          parent: item,
        }),
      onAddTop: (targetCompanyId) =>
        setEditor({
          mode: "add",
          companyId: targetCompanyId,
          parent: null,
        }),
      onEdit: (item, targetCompanyId) =>
        setEditor({ mode: "edit", companyId: targetCompanyId, node: item }),
      onDragStart: setDraggedUserId,
      onDragEnd: () => setDraggedUserId(null),
      onMove: (source, target, targetCompanyId) =>
        void moveAssignment(source, target, targetCompanyId),
      onRemove: (item, targetCompanyId) =>
        setRemoving({ assignment: item, companyId: targetCompanyId }),
      onOpen: (item, targetCompanyId) => {
        setProfileUserId(item.userId._id);
        setProfileCompanyId(targetCompanyId);
      },
      onLinkCompany: (item, parentCompanyId) =>
        setLinking({ parent: item, parentCompanyId }),
      onUnlinkCompany: (company) => setUnlinkingCompany(company),
      onManageRoles: (targetCompanyId) => {
        setManageRoleCompanyId(targetCompanyId);
        setManageRoles(true);
      },
      onApplyCompanyAccess: (company, source) => {
        void assignCompanyAnchorRole(company.id, source).catch(
          (error: unknown) =>
            toast.error(errorText(error, "Company access could not be assigned.")),
        );
      },
    };
  };
  for (const company of descendantCompanies) {
    const companyAssignments = companyItems.get(company.id) ?? [];
    companyContexts.set(
      company.id,
      createCompanyContext(
        company.id,
        companyAssignments,
        buildChildrenForCompany(companyAssignments),
      ),
    );
  }
  const context = createCompanyContext(
    managementCompanyId,
    items,
    visibleChildren,
  );
  const roots = visibleChildren.get(ROOT) ?? [];
  const departmentsInUse = new Set(items.map((item) => item.department)).size;
  const canAddTop = structureAdmin;
  const showTeamOnboarding =
    (isExecutive || isManager || isHr) &&
    (managementCompanyId === me?.company?.id || !isExecutive);
  const chooseCompany = (companyId: string) => {
    if (companyId === managementCompanyId) return;
    setSelectedCompanyId(companyId);
    setItems([]);
    setLoading(true);
    setLoadError("");
    setQuery("");
    setDepartment("ALL");
    setCollapsed(new Set());
    setCompanyCollapsed(false);
    setEditor(null);
    setManageRoles(false);
  };

  if (loading)
    return (
      <div className="flex min-h-100 items-center justify-center">
        <LoaderCircle
          className="animate-spin text-[#1645a2]"
          aria-label="Loading organization"
        />
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-350 space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-[#dfe6ee] bg-white px-5 py-5 shadow-[0_4px_18px_rgba(31,58,91,0.04)] sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#1645a2]">
            <Network size={13} /> People &amp; structure
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-[-0.03em] text-(--brand-navy)">
            Organization chart
          </h1>
          <p className="mt-1 text-sm text-[#71829e]">
            {structureAdmin
              ? "Add, edit, or remove anyone directly from their place in the reporting tree."
              : "Your department's reporting tree. You can manage your direct reports."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isExecutive && companies.length > 1 ? (
            <label className="inline-flex h-11 items-center gap-2 rounded-md border border-[#dfe6ee] bg-white px-3 text-xs font-semibold text-[#52637d]">
              <Building2 size={15} className="text-[#1645a2]" />
              <span className="sr-only">Manage company</span>
              <select
                aria-label="Manage company structure"
                value={managementCompanyId}
                onChange={(event) => chooseCompany(event.target.value)}
                className="max-w-48 bg-transparent text-xs font-semibold text-[#263547] outline-none"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {showTeamOnboarding ? (
            <ManagerTeamMemberDialog onSuccess={() => void load()} />
          ) : null}
          {structureAdmin ? (
            <button
              type="button"
              onClick={() => {
                if (roleCatalog) {
                  setManageRoleCompanyId(managementCompanyId);
                  setManageRoles(true);
                }
                else
                void OrganizationService.roles(managementCompanyId).then((catalog) => {
                    setRoleCatalog(catalog);
                    setManageRoleCompanyId(managementCompanyId);
                    setManageRoles(true);
                }).catch((error: unknown) => {
                  toast.error(errorText(error, "Roles could not be loaded."));
                });
              }}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#dfe6ee] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f6f8fa]"
            >
              <Settings2 size={15} /> Manage roles
            </button>
          ) : null}
          <span className="inline-flex h-11 items-center gap-2 rounded-md bg-[#eefbf6] px-3 text-xs font-semibold text-[#008f69]">
            <ShieldCheck size={15} />{" "}
            {isExecutive ? "Full access" : isHr ? "HR access" : "Team access"}
          </span>
        </div>
      </header>

      <div
        className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${isExecutive ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}
      >
        <Summary label="People" value={items.length} />
        <Summary label="Departments" value={departmentsInUse} />
        <Summary
          label="Heads"
          value={items.filter((item) => item.level === "HEAD").length}
        />
        <Summary
          label="Managers"
          value={items.filter((item) => item.level === "MANAGER").length}
        />
        <Summary
          label="Members"
          value={items.filter((item) => item.level === "MEMBER").length}
        />
        {isExecutive ? (
          <Summary label="Total companies" value={companies.length} />
        ) : null}
      </div>

      <div
        aria-label="Organization chart color legend"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[#e7edf4] bg-white/80 px-4 py-3 text-[11px] font-semibold text-[#64748b]"
      >
        <span className="mr-1 uppercase tracking-wide text-[#94a3b8]">Key</span>
        <LegendItem color="bg-violet-600" label="CEO" />
        <LegendItem color="bg-orange-600" label="HR" />
        <LegendItem color="bg-blue-700" label="Department head" />
        <LegendItem color="bg-emerald-600" label="Manager" />
        <LegendItem color="bg-slate-500" label="Employee / intern" />
        <LegendItem
          color="bg-linear-to-r from-blue-600 via-teal-500 to-amber-500"
          label="Company"
        />
      </div>

      <section className="overflow-clip rounded-2xl border border-[#dfe6ee] bg-white shadow-[0_4px_18px_rgba(31,58,91,0.04)]">
        <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-[#94a3b8] focus-within:border-[#1645a2] focus-within:ring-3 focus-within:ring-[#1645a2]/10 sm:max-w-80">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a person or role"
                aria-label="Find a person in the organization"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#172033] outline-none"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="rounded p-0.5 hover:bg-[#eef2f7]"
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>
            {structureAdmin ? (
              <select
                aria-label="Filter by department"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className="h-10 rounded-lg border border-[#dfe6ee] bg-white px-3 text-sm text-[#263547] outline-none focus:border-[#1645a2]"
              >
                <option value="ALL">All departments</option>
                {DEPARTMENTS.map((item) => (
                  <option key={item} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="inline-flex h-10 items-center rounded-lg bg-[#f1f5f9] px-3 text-sm font-semibold text-[#52637d]">
                {titleCase(myDepartment)} department
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Chart layout"
              className="inline-flex rounded-lg border border-[#dfe6ee] bg-[#f8fafc] p-0.5"
            >
              <button
                type="button"
                aria-pressed={view === "chart"}
                onClick={() => setChosenView("chart")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${view === "chart" ? "bg-white text-[#1645a2] shadow-sm" : "text-[#64748b] hover:text-[#172033]"}`}
              >
                <Network size={14} /> Chart
              </button>
              <button
                type="button"
                aria-pressed={view === "outline"}
                onClick={() => setChosenView("outline")}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition ${view === "outline" ? "bg-white text-[#1645a2] shadow-sm" : "text-[#64748b] hover:text-[#172033]"}`}
              >
                <ListTree size={14} /> Outline
              </button>
            </div>
            {view === "chart" ? (
              <div
                className="inline-flex items-center rounded-lg border border-[#dfe6ee] bg-white"
                role="group"
                aria-label="Zoom"
              >
                <IconButton
                  label="Zoom out"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={() =>
                    setZoom((value) =>
                      Math.max(MIN_ZOOM, Math.round((value - 0.1) * 10) / 10),
                    )
                  }
                >
                  <Minus size={14} />
                </IconButton>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  title="Reset zoom"
                  className="h-9 min-w-13 px-1 text-xs font-semibold text-[#475569] hover:text-[#1645a2]"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <IconButton
                  label="Zoom in"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={() =>
                    setZoom((value) =>
                      Math.min(MAX_ZOOM, Math.round((value + 0.1) * 10) / 10),
                    )
                  }
                >
                  <Plus size={14} />
                </IconButton>
                <IconButton label="Fit chart to screen" onClick={fitToScreen}>
                  <Maximize2 size={14} />
                </IconButton>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setCompanyCollapsed(false);
                setCollapsed(new Set());
              }}
              className="h-9 rounded-lg px-2.5 text-xs font-semibold text-[#1673cf] hover:bg-[#eef4ff]"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={() =>
                setCollapsed(
                  new Set(
                    [...fullChildren.keys()].filter((key) => key !== ROOT),
                  ),
                )
              }
              className="h-9 rounded-lg px-2.5 text-xs font-semibold text-[#1673cf] hover:bg-[#eef4ff]"
            >
              Collapse all
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="inline-flex items-center gap-1.5 font-semibold hover:underline"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : null}

        {view === "chart" ? (
          <div ref={viewportRef} className={styles.viewport}>
            <div ref={canvasRef} className={styles.canvas} style={{ zoom }}>
              <ul
                className={styles.tree}
                role="tree"
                aria-label="Organisation chart"
              >
                <li
                  role="treeitem"
                  aria-expanded={!companyCollapsed}
                  aria-selected={false}
                >
                  <div
                    ref={companyRef}
                    className={styles.node}
                    data-level="ORGANISATION"
                  >
                    <div className={styles.nodeMain}>
                      <span className={styles.avatar}>
                        <Building2 size={18} />
                      </span>
                      <span className={styles.nodeText}>
                        <strong>{selectedCompanyName}</strong>
                        <span>
                          {items.length} people · {departmentsInUse} departments
                        </span>
                        <small>
                          {department === "ALL"
                            ? "Organisation-wide view"
                            : `${titleCase(department)} department`}
                        </small>
                      </span>
                    </div>
                    {canAddTop ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          aria-label="Add to the top of the organization"
                          title="Add CEO, HR administrator, or department head"
                          onClick={() =>
                            context.onAddTop(managementCompanyId)
                          }
                        >
                          <UserPlus size={15} />
                        </button>
                      </div>
                    ) : null}
                    {roots.length ? (
                      <button
                        type="button"
                        className={styles.toggle}
                        aria-label={
                          companyCollapsed
                            ? "Expand organization"
                            : "Collapse organization"
                        }
                        onClick={() => setCompanyCollapsed((value) => !value)}
                      >
                        {companyCollapsed ? (
                          <ChevronDown size={13} />
                        ) : (
                          <ChevronUp size={13} />
                        )}
                        {roots.length}
                      </button>
                    ) : null}
                  </div>
                  {!companyCollapsed && roots.length ? (
                    <ul role="group">
                      {roots.map((item) => (
                        <ChartBranch
                          key={item._id}
                          item={item}
                          context={context}
                          trail={[]}
                        />
                      ))}
                    </ul>
                  ) : null}
                </li>
              </ul>
              {!roots.length ? (
                <EmptyState
                  filtering={Boolean(query.trim() || department !== "ALL")}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="border-t border-[#e6edf3] px-2 py-3 sm:px-4">
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <button
                type="button"
                onClick={() => setCompanyCollapsed((value) => !value)}
                aria-label={
                  companyCollapsed
                    ? "Expand organization"
                    : "Collapse organization"
                }
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#64748b] hover:bg-[#eef2f7]"
              >
                {companyCollapsed ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-[#0f172a]">
                <Building2 size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#172033]">
                  {selectedCompanyName}
                </p>
                <p className="text-xs text-[#71829e]">{items.length} people</p>
              </div>
              {canAddTop ? (
                <OutlineAction
                  label="Add to the top of the organization"
                  onClick={() => context.onAddTop(managementCompanyId)}
                >
                  <UserPlus size={15} />
                </OutlineAction>
              ) : null}
            </div>
            {!companyCollapsed ? (
              <ul
                role="tree"
                aria-label="Organization outline"
                className="ml-3 border-l border-dashed border-[#c9d3df] pl-1 sm:ml-5 sm:pl-2"
              >
                {roots.map((item) => (
                  <OutlineBranch
                    key={item._id}
                    item={item}
                    context={context}
                    trail={[]}
                  />
                ))}
              </ul>
            ) : null}
            {!roots.length ? (
              <EmptyState
                filtering={Boolean(query.trim() || department !== "ALL")}
              />
            ) : null}
          </div>
        )}
      </section>

      {editor ? (
        <NodeEditor
          key={
            editor.mode === "add"
              ? `add-${editor.companyId}-${editor.parent?._id ?? "root"}`
              : `edit-${editor.companyId}-${editor.node._id}`
          }
          editor={editor}
          items={companyItems.get(editor.companyId) ?? []}
          isExecutive={isExecutive}
          structureAdmin={structureAdmin}
          canAssignHrLevel={canAssignHrLevel}
          isHr={isHr}
          roleCatalog={
            editor.companyId === managementCompanyId
              ? roleCatalog
              : linkedRoleCatalogs.get(editor.companyId) ?? null
          }
          companyId={editor.companyId}
          myId={myId}
          hasReports={(item) =>
            Boolean(
              buildChildrenForCompany(
                companyItems.get(editor.companyId) ?? [],
              ).get(item.userId._id)?.length,
            )
          }
          onClose={() => setEditor(null)}
          onViewProfile={(userId) => {
            setProfileUserId(userId);
            setProfileCompanyId(editor.companyId);
          }}
          onSaved={async (assignment, message) => {
            upsert(assignment, editor.companyId);
            setEditor(null);
            toast.success(message);
            if (editor.companyId === managementCompanyId) {
              void load();
            } else {
              setLinkedRevision((revision) => revision + 1);
            }
          }}
        />
      ) : null}
      {manageRoles &&
      (manageRoleCompanyId === managementCompanyId
        ? roleCatalog
        : linkedRoleCatalogs.get(manageRoleCompanyId)) ? (
        <OrganizationRoleManager
          catalog={
            (manageRoleCompanyId === managementCompanyId
              ? roleCatalog
              : linkedRoleCatalogs.get(manageRoleCompanyId))!
          }
          companyId={manageRoleCompanyId}
          onCatalogChange={(catalog) => {
            if (manageRoleCompanyId === managementCompanyId)
              setRoleCatalog(catalog);
            else
              setLinkedRoleCatalogs((current) =>
                new Map(current).set(manageRoleCompanyId, catalog),
              );
          }}
          onClose={() => setManageRoles(false)}
        />
      ) : null}
      {removing
        ? createPortal(
            <OrganizationRemovalDialog
              assignment={removing.assignment}
              companyId={removing.companyId}
              open
              onClose={() => setRemoving(null)}
              onRemoved={(userId) => {
                if (removing.companyId === managementCompanyId)
                  setItems((current) =>
                    current.filter((item) => item.userId._id !== userId),
                  );
                else
                  setLinkedItems((current) => {
                    const next = new Map(current);
                    next.set(
                      removing.companyId,
                      (next.get(removing.companyId) ?? []).filter(
                        (item) => item.userId._id !== userId,
                      ),
                    );
                    return next;
                  });
                toast.success(
                  `${removing.assignment.userId.name} was removed from the organization.`,
                );
              }}
            />,
            document.body,
          )
        : null}
      {unlinkingCompany
        ? createPortal(
            <CompanyOrganizationRemovalDialog
              company={unlinkingCompany}
              onClose={() => setUnlinkingCompany(null)}
              onRemoved={(removedAssignments) => {
                setUnlinkingCompany(null);
                setCompanies((current) =>
                  current.filter(
                    (company) => company.id !== unlinkingCompany.id,
                  ),
                );
                setLinkedItems((current) => {
                  const next = new Map(current);
                  next.delete(unlinkingCompany.id);
                  return next;
                });
                setLinkedRoleCatalogs((current) => {
                  const next = new Map(current);
                  next.delete(unlinkingCompany.id);
                  return next;
                });
                setLinkedRevision((revision) => revision + 1);
                toast.success(
                  `${unlinkingCompany.name} and ${removedAssignments} organization assignment${removedAssignments === 1 ? "" : "s"} were removed from the chart.`,
                );
                void CompanyService.list()
                  .then(setCompanies)
                  .catch((error: unknown) =>
                    toast.error(
                      errorText(
                        error,
                        "The company was removed, but the company list could not be refreshed.",
                      ),
                    ),
                  );
              }}
            />,
            document.body,
          )
        : null}
      {linking ? (
        <CompanyLinkDialog
          companies={companies.filter(
            (company) =>
              !company.is_default &&
              company.id !== linking.parentCompanyId &&
              !company.organization_parent_company_id,
          )}
          parentCompanyName={
            companies.find(
              (company) => company.id === linking.parentCompanyId,
            )?.name ?? selectedCompanyName
          }
          anchorName={linking.parent.userId.name}
          onClose={() => setLinking(null)}
          onContinue={async (companyId) => {
            try {
              await assignCompanyAnchorRole(
                companyId,
                linking.parent,
                linking.parentCompanyId,
              );
              setLinking(null);
            } catch (error) {
              toast.error(
                errorText(error, "The company could not be assigned."),
              );
            }
          }}
        />
      ) : null}
      <UserProfileDialog
        userId={profileUserId}
        companyId={profileCompanyId ?? managementCompanyId}
        onClose={() => {
          setProfileUserId(null);
          setProfileCompanyId(undefined);
        }}
      />
    </div>
  );
}

function ChartBranch({
  item,
  context,
  trail,
}: {
  item: OrganizationAssignment;
  context: TreeContext;
  trail: string[];
}) {
  const id = item.userId._id;
  if (trail.includes(id)) return null;
  const children = context.childrenOf.get(id) ?? [];
  const linkedCompanies =
    context.linkedCompaniesByParent.get(`${context.companyId}:${id}`) ?? [];
  const expanded = !context.collapsed.has(id);
  const teamOnly =
    linkedCompanies.length === 0 &&
    children.length > 0 &&
    children.every(
      (child) =>
        child.level === "MEMBER" &&
        !context.childrenOf.get(child.userId._id)?.length,
    );
  return (
    <li
      role="treeitem"
      aria-expanded={children.length || linkedCompanies.length ? expanded : undefined}
      aria-selected={false}
    >
      <div
        className={styles.node}
        data-level={item.level}
        data-match={context.matches.has(id) || undefined}
        data-self={id === context.myId || undefined}
        draggable={context.canMove(item)}
        onDragStart={(event) => {
          if (!context.canMove(item)) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", id);
          context.onDragStart(id);
        }}
        onDragEnd={context.onDragEnd}
        onDragOver={(event) => {
          const source = context.items.find(
            (candidate) => candidate.userId._id === context.draggedUserId,
          );
          if (!source || !context.canDrop(source, item)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          event.currentTarget.dataset.dropTarget = "true";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            delete event.currentTarget.dataset.dropTarget;
        }}
        onDrop={(event) => {
          event.preventDefault();
          delete event.currentTarget.dataset.dropTarget;
          const sourceId =
            event.dataTransfer.getData("text/plain") || context.draggedUserId;
          const source = context.items.find(
            (candidate) => candidate.userId._id === sourceId,
          );
          if (source && context.canDrop(source, item))
            context.onMove(source, item, context.companyId);
        }}
      >
        <NodeBody item={item} context={context} />
        <NodeActions item={item} context={context} />
        {children.length || linkedCompanies.length ? (
          <button
            type="button"
            className={styles.toggle}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${item.userId.name}'s organization branches`}
            aria-expanded={expanded}
            onClick={() => context.toggle(id)}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {children.length + linkedCompanies.length}
          </button>
        ) : null}
      </div>
      {expanded && (children.length || linkedCompanies.length) ? (
        teamOnly ? (
          <ul role="group">
            <li role="none">
              <div className={styles.team}>
                <div className={styles.teamTitle}>
                  <span>{item.userId.name.split(" ")[0]}&apos;s team</span>
                  <span>{children.length}</span>
                </div>
                <ul className={styles.teamList} role="group">
                  {children.map((child) => (
                    <li
                      key={child._id}
                      role="treeitem"
                      aria-selected={false}
                      className={styles.teamMember}
                      data-level={child.level}
                      data-match={
                        context.matches.has(child.userId._id) || undefined
                      }
                      draggable={context.canMove(child)}
                      onDragStart={(event) => {
                        if (!context.canMove(child)) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData(
                          "text/plain",
                          child.userId._id,
                        );
                        context.onDragStart(child.userId._id);
                      }}
                      onDragEnd={context.onDragEnd}
                      onDragOver={(event) => {
                        const source = context.items.find(
                          (candidate) =>
                            candidate.userId._id === context.draggedUserId,
                        );
                        if (!source || !context.canDrop(source, child)) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        event.currentTarget.dataset.dropTarget = "true";
                      }}
                      onDragLeave={(event) => {
                        if (
                          !event.currentTarget.contains(
                            event.relatedTarget as Node | null,
                          )
                        )
                          delete event.currentTarget.dataset.dropTarget;
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        delete event.currentTarget.dataset.dropTarget;
                        const sourceId =
                          event.dataTransfer.getData("text/plain") ||
                          context.draggedUserId;
                        const source = context.items.find(
                          (candidate) => candidate.userId._id === sourceId,
                        );
                        if (source && context.canDrop(source, child))
                          context.onMove(source, child, context.companyId);
                      }}
                    >
                      <NodeBody item={child} context={context} compact />
                      <NodeActions item={child} context={context} />
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          </ul>
        ) : (
          <ul role="group">
            {children.map((child) => (
              <ChartBranch
                key={child._id}
                item={child}
                context={context}
                trail={[...trail, id]}
              />
            ))}
            {linkedCompanies.map((company) => (
              <LinkedCompanyNode
                key={company.id}
                company={company}
                context={context.companyContexts.get(company.id)}
                parentContext={context}
                outline={false}
              />
            ))}
          </ul>
        )
      ) : null}
    </li>
  );
}

function LinkedCompanyNode({
  company,
  context,
  parentContext,
  outline,
}: {
  company: Company;
  context?: TreeContext;
  parentContext: TreeContext;
  outline: boolean;
}) {
  if (!context) return null;
  const roots = context.childrenOf.get(ROOT) ?? [];
  const anchor = company.organization_anchor_user_id
    ? parentContext.items.find(
        (item) =>
          item.userId._id === company.organization_anchor_user_id,
      )
    : undefined;
  const anchorAssignment = anchor
    ? context.items.find((item) => item.userId._id === anchor.userId._id)
    : undefined;
  const anchorChildren = anchorAssignment
    ? context.childrenOf.get(anchorAssignment.userId._id) ?? []
    : [];
  const visibleRoots = anchorAssignment
    ? roots.flatMap((item) =>
        item.userId._id === anchorAssignment.userId._id
          ? anchorChildren
          : [item],
      )
    : roots;
  const anchorAlreadyAssigned = Boolean(anchorAssignment);
  const expanded = !context.collapsed.has(ROOT);
  return (
    <li role="treeitem" aria-expanded={expanded} aria-selected={false} className="list-none">
      <div
        className={`${styles.companyNode} ${outline ? "p-3" : "px-4 py-3"}`}
        data-tone={companyTone(company.id)}
      >
        <div
          className="flex min-w-0 items-center gap-3"
          onDragOver={(event) => {
            if (!anchorAssignment) return;
            const source = context.items.find(
              (item) => item.userId._id === context.draggedUserId,
            );
            if (!source || !context.canDrop(source, anchorAssignment)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            event.currentTarget.dataset.dropTarget = "true";
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              delete event.currentTarget.dataset.dropTarget;
          }}
          onDrop={(event) => {
            if (!anchorAssignment) return;
            const sourceId =
              event.dataTransfer.getData("text/plain") || context.draggedUserId;
            const source = context.items.find(
              (item) => item.userId._id === sourceId,
            );
            if (!source || !context.canDrop(source, anchorAssignment)) return;
            event.preventDefault();
            delete event.currentTarget.dataset.dropTarget;
            context.onMove(source, anchorAssignment, company.id);
          }}
        >
          <button
            type="button"
            onClick={() => context.toggle(ROOT)}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${company.name}`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#64748b] hover:bg-[#eef2f7]"
          >
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <span className={`${styles.companyIcon} flex size-9 shrink-0 items-center justify-center rounded-full`}>
            <Building2 size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className={`${styles.companyName} block truncate text-sm`}>{company.name}</strong>
            <small className={`${styles.companyMeta} block text-xs`}>
              {anchorAssignment
                ? `${anchorChildren.length} direct report${anchorChildren.length === 1 ? "" : "s"} under ${anchorAssignment.userId.name}`
                : `${roots.length} top-level ${roots.length === 1 ? "assignment" : "assignments"}`}
            </small>
          </span>
          {context.canLinkCompany() ? (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={`Manage ${company.name} roles`}
                title="Manage company roles"
                onClick={() => context.onManageRoles(company.id)}
                className={`${styles.companyAction} flex size-8 items-center justify-center rounded-md text-[#64748b]`}
              >
                <Settings2 size={15} />
              </button>
              {anchor ? (
                <button
                  type="button"
                  aria-label={
                    anchorAlreadyAssigned
                      ? `Preserve ${anchor.userId.name}'s role and ensure full access in ${company.name}`
                      : `Assign ${anchor.userId.name} as Projects Head with full access in ${company.name}`
                  }
                  title={
                    anchorAlreadyAssigned
                      ? "Keep this person's company role and ensure full company access"
                      : "Assign this person as Projects Head with full company access"
                  }
                  onClick={() =>
                    context.onApplyCompanyAccess(company, anchor)
                  }
                  className={`${styles.companyAction} flex size-8 items-center justify-center rounded-md text-[#64748b]`}
                >
                  <ShieldCheck size={15} />
                </button>
              ) : null}
              <button
                type="button"
                aria-label={
                  anchorAssignment
                    ? `Add a report under ${anchorAssignment.userId.name} in ${company.name}`
                    : `Add a role in ${company.name}`
                }
                title={
                  anchorAssignment
                    ? `Add a direct report under ${anchorAssignment.userId.name}`
                    : "Add a CEO, department head, manager, or member"
                }
                onClick={() =>
                  anchorAssignment
                    ? context.onAdd(anchorAssignment, company.id)
                    : context.onAddTop(company.id)
                }
                className={`${styles.companyAction} flex size-8 items-center justify-center rounded-md text-[#64748b]`}
              >
                <UserPlus size={15} />
              </button>
              <button
                type="button"
                aria-label={`Unlink ${company.name}`}
                title="Remove company from this organization chart"
                onClick={() => context.onUnlinkCompany(company)}
                className="flex size-8 items-center justify-center rounded-md text-[#64748b] hover:bg-red-50 hover:text-red-600"
              >
                <X size={15} />
              </button>
            </div>
          ) : null}
        </div>
        {expanded ? (
          visibleRoots.length ? (
            <ul
              role="group"
              className={
                outline
                  ? "ml-3 border-l border-dashed border-[#c9d3df] pl-1 sm:ml-5 sm:pl-2"
                  : "ml-5 border-l border-dashed border-[#c9d3df] pl-3"
              }
            >
              {visibleRoots.map((item) =>
                outline ? (
                  <OutlineBranch
                    key={item._id}
                    item={item}
                    context={context}
                    trail={[]}
                  />
                ) : (
                  <ChartBranch
                    key={item._id}
                    item={item}
                    context={context}
                    trail={[]}
                  />
                ),
              )}
            </ul>
          ) : (
            <div className="pl-10 pt-2 text-xs text-[#71829e]">
              {anchorAssignment
                ? `No reports assigned under ${anchorAssignment.userId.name} yet. Add the first person to start the team.`
                : "No roles assigned yet. Add the company CEO or department roles here."}
            </div>
          )
        ) : null}
      </div>
    </li>
  );
}

function NodeBody({
  item,
  context,
  compact = false,
}: {
  item: OrganizationAssignment;
  context: TreeContext;
  compact?: boolean;
}) {
  const assignedRoles = item.roleKeys?.length
    ? item.roleKeys.map(context.roleLabel).join(" · ")
    : roleTitle(item);
  return (
    <button
      type="button"
      className={styles.nodeMain}
      onClick={() => context.onOpen(item, context.companyId)}
      title={`View ${item.userId.name}'s profile`}
    >
      <span className={styles.avatar}>{initials(item.userId.name)}</span>
      <span className={styles.nodeText}>
        <strong>
          {item.userId.name}
          {item.userId._id === context.myId ? " (you)" : ""}
        </strong>
        <span className={styles.roleBadge}>{assignedRoles}</span>
        {compact ? null : <small>{item.userId.email}</small>}
      </span>
    </button>
  );
}

function NodeActions({
  item,
  context,
}: {
  item: OrganizationAssignment;
  context: TreeContext;
}) {
  const add = context.canAdd(item);
  const edit = context.canEdit(item);
  if (!add && !edit) return null;
  const blocked = context.hasReports(item);
  return (
    <div className={styles.actions}>
      {context.canMove(item) ? (
        <span
          className={styles.dragHandle}
          title="Drag to change reporting manager"
          aria-label="Drag to change reporting manager"
        >
          <GripVertical size={15} />
        </span>
      ) : null}
      {add ? (
        <button
          type="button"
          aria-label={`Add a report under ${item.userId.name}`}
          title="Add report"
          onClick={() => context.onAdd(item, context.companyId)}
        >
          <UserPlus size={15} />
        </button>
      ) : null}
      {context.canLinkCompany() ? (
        <button
          type="button"
          aria-label={`Add a company under ${item.userId.name}`}
          title="Add a company branch here"
          onClick={() => context.onLinkCompany(item, context.companyId)}
        >
          <Building2 size={15} />
        </button>
      ) : null}
      {edit ? (
        <button
          type="button"
          aria-label={`Edit ${item.userId.name}`}
          title="Edit"
          onClick={() => context.onEdit(item, context.companyId)}
        >
          <Pencil size={14} />
        </button>
      ) : null}
      {edit && item.userId._id !== context.myId ? (
        <button
          type="button"
          data-danger="true"
          aria-label={`Remove ${item.userId.name}`}
          title={blocked ? "Move or remove their reports first" : "Remove"}
          disabled={blocked}
          onClick={() => context.onRemove(item, context.companyId)}
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}

function OutlineBranch({
  item,
  context,
  trail,
}: {
  item: OrganizationAssignment;
  context: TreeContext;
  trail: string[];
}) {
  const id = item.userId._id;
  if (trail.includes(id)) return null;
  const children = context.childrenOf.get(id) ?? [];
  const linkedCompanies =
    context.linkedCompaniesByParent.get(`${context.companyId}:${id}`) ?? [];
  const expanded = !context.collapsed.has(id);
  const add = context.canAdd(item);
  const edit = context.canEdit(item);
  const blocked = context.hasReports(item);
  return (
    <li
      role="treeitem"
      aria-expanded={children.length || linkedCompanies.length ? expanded : undefined}
      aria-selected={false}
      className="mb-2 list-none"
    >
      <div
        data-level={item.level}
        draggable={context.canMove(item)}
        onDragStart={(event) => {
          if (!context.canMove(item)) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", id);
          context.onDragStart(id);
        }}
        onDragEnd={context.onDragEnd}
        onDragOver={(event) => {
          const source = context.items.find(
            (candidate) => candidate.userId._id === context.draggedUserId,
          );
          if (!source || !context.canDrop(source, item)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          event.currentTarget.dataset.dropTarget = "true";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            delete event.currentTarget.dataset.dropTarget;
        }}
        onDrop={(event) => {
          event.preventDefault();
          delete event.currentTarget.dataset.dropTarget;
          const sourceId =
            event.dataTransfer.getData("text/plain") || context.draggedUserId;
          const source = context.items.find(
            (candidate) => candidate.userId._id === sourceId,
          );
          if (source && context.canDrop(source, item))
            context.onMove(source, item, context.companyId);
        }}
        className={`${styles.outlineNode} group flex items-center gap-2 rounded-xl px-3 py-2.5 transition hover:bg-[#f6f8fb] sm:gap-2.5 sm:px-4 ${context.matches.has(id) ? "bg-amber-50" : ""}`}
      >
        {children.length || linkedCompanies.length ? (
          <button
            type="button"
            onClick={() => context.toggle(id)}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${item.userId.name}'s organization branches`}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#64748b] hover:bg-[#eef2f7]"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="size-7 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => context.onOpen(item, context.companyId)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left"
        >
          <span
            data-level={item.level}
            className={`${styles.avatar} size-9! text-xs!`}
          >
            {initials(item.userId.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#172033]">
              {item.userId.name}
              {id === context.myId ? " (you)" : ""}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-[#71829e]">
              <span className={styles.roleBadge}>
                {item.roleKeys?.length
                  ? item.roleKeys.map(context.roleLabel).join(" · ")
                  : roleTitle(item)}
              </span>
              {children.length + linkedCompanies.length
                ? `${children.length + linkedCompanies.length} branch${children.length + linkedCompanies.length === 1 ? "" : "es"}`
                : ""}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {context.canMove(item) ? (
            <span
              className={styles.dragHandle}
              title="Drag to change reporting manager"
              aria-label="Drag to change reporting manager"
            >
              <GripVertical size={15} />
            </span>
          ) : null}
          {add ? (
            <OutlineAction
              label={`Add a report under ${item.userId.name}`}
              onClick={() => context.onAdd(item, context.companyId)}
            >
              <UserPlus size={15} />
            </OutlineAction>
          ) : null}
          {context.canLinkCompany() ? (
            <OutlineAction
              label={`Add a company under ${item.userId.name}`}
              onClick={() => context.onLinkCompany(item, context.companyId)}
            >
              <Building2 size={15} />
            </OutlineAction>
          ) : null}
          {edit ? (
            <OutlineAction
              label={`Edit ${item.userId.name}`}
              onClick={() => context.onEdit(item, context.companyId)}
            >
              <Pencil size={14} />
            </OutlineAction>
          ) : null}
          {edit && id !== context.myId ? (
            <OutlineAction
              label={
                blocked
                  ? "Move or remove their reports first"
                  : `Remove ${item.userId.name}`
              }
              danger
              disabled={blocked}
              onClick={() => context.onRemove(item, context.companyId)}
            >
              <Trash2 size={14} />
            </OutlineAction>
          ) : null}
        </div>
      </div>
      {expanded && (children.length || linkedCompanies.length) ? (
        <ul
          role="group"
          className="ml-3 border-l border-dashed border-[#c9d3df] pl-1 sm:ml-5 sm:pl-2"
        >
          {children.map((child) => (
            <OutlineBranch
              key={child._id}
              item={child}
              context={context}
              trail={[...trail, id]}
            />
          ))}
          {linkedCompanies.map((company) => (
            <LinkedCompanyNode
              key={company.id}
              company={company}
              context={context.companyContexts.get(company.id)}
              parentContext={context}
              outline
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function OutlineAction({
  label,
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-md text-[#64748b] transition sm:size-8 disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-[#eef4ff] hover:text-[#1645a2]"}`}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center text-[#475569] transition hover:text-[#1645a2] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <section className="rounded-2xl border border-[#dfe6ee] bg-white px-5 py-5 shadow-[0_4px_14px_rgba(31,58,91,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71829e]">
        {label}
      </p>
      <strong className="mt-1.5 block text-2xl tracking-[-0.03em] text-(--brand-navy)">
        {value}
      </strong>
    </section>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={`size-2.5 rounded-full ${color}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function EmptyState({ filtering }: { filtering: boolean }) {
  return (
    <div className="mx-auto max-w-sm px-6 py-12 text-center">
      <Network className="mx-auto text-[#a7b4c4]" size={28} />
      <p className="mt-3 text-sm font-semibold text-[#172033]">
        {filtering ? "No one matches this view" : "No one has been placed yet"}
      </p>
      <p className="mt-1 text-xs text-[#71829e]">
        {filtering
          ? "Try a different name or department."
          : "Use the add button on the company card to place the CEO or a department head."}
      </p>
    </div>
  );
}

function CompanyLinkDialog({
  companies,
  parentCompanyName,
  anchorName,
  onClose,
  onContinue,
}: {
  companies: Company[];
  parentCompanyName: string;
  anchorName: string;
  onClose: () => void;
  onContinue: (companyId: string) => Promise<void>;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  return createPortal(
    <div
      className="dashboard-shell fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/50 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-link-title"
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.3)] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="company-link-title" className="text-base font-bold text-[#172033]">
              Add a company branch
            </h2>
            <p className="mt-1 text-sm text-[#71829e]">
              {anchorName} keeps their roles in {parentCompanyName} and is
              assigned as Projects Head with CEO/Admin-level access in the new
              company. Their account roles will not change.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f1f5f9]"
          >
            <X size={17} />
          </button>
        </div>
        {companies.length ? (
          <>
            <label className="mt-5 block text-xs font-semibold text-[#52637d]">
              Company
              <select
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                className="mt-2 h-11 w-full rounded-lg border border-[#dfe6ee] bg-white px-3 text-sm text-[#172033] outline-none focus:border-[#1645a2]"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={onClose}
                className="h-10 rounded-lg border border-[#dfe6ee] px-4 text-sm font-semibold text-[#52637d]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !companyId}
                onClick={async () => {
                  setSaving(true);
                  await onContinue(companyId);
                  setSaving(false);
                }}
                className="h-10 rounded-lg bg-[#1645a2] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Assigning company…" : "Assign company"}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-5 rounded-lg bg-[#f8fafc] p-3 text-sm text-[#71829e]">
            There are no unlinked companies available. A company can only appear
            once in this organization chart.
          </p>
        )}
      </section>
    </div>,
    document.body,
  );
}

function NodeEditor({
  editor,
  items,
  isExecutive,
  structureAdmin,
  canAssignHrLevel,
  isHr,
  roleCatalog,
  companyId,
  myId,
  hasReports,
  onClose,
  onSaved,
  onViewProfile,
}: {
  editor: Editor;
  items: OrganizationAssignment[];
  isExecutive: boolean;
  structureAdmin: boolean;
  canAssignHrLevel: boolean;
  isHr: boolean;
  roleCatalog: OrganizationRoleCatalog | null;
  companyId: string;
  myId?: string;
  hasReports: (item: OrganizationAssignment) => boolean;
  onClose: () => void;
  onSaved: (assignment: OrganizationAssignment, message: string) => void;
  onViewProfile: (userId: string) => void;
}) {
  const admin = useAppSelector(
    (state) => state.auth.user?.roles.includes("ADMIN") ?? false,
  );
  const adding = editor.mode === "add";
  const parent = adding ? editor.parent : null;
  const node = adding ? null : editor.node;
  const ownAssignment = Boolean(node && node.userId._id === myId);
  const locked = !isExecutive && node ? hasReports(node) : false;
  const hasCeo = items.some((item) => item.level === "CEO");
  const rawLevelOptions: Level[] = ownAssignment
    ? [node!.level]
    : isExecutive
      ? [
          "HEAD",
          "MANAGER",
          "MEMBER",
          ...(!adding && node?.level === "HR" ? ["HR" as const] : []),
          ...(!parent && adding ? ["HR" as const] : []),
          "CEO",
        ]
      : adding
        ? parent
          ? [NEXT_LEVEL[parent.level]!]
          : canAssignHrLevel
            ? ["HR", "HEAD"]
            : isExecutive && !hasCeo
              ? ["CEO", "HEAD"]
              : ["HEAD"]
        : !structureAdmin || locked
          ? [node!.level]
          : canAssignHrLevel
            ? ["HR", "HEAD", "MANAGER", "MEMBER"]
            : isExecutive
              ? ["CEO", "HEAD", "MANAGER", "MEMBER"]
              : ["HEAD", "MANAGER", "MEMBER"];
  const levelOptions = rawLevelOptions.filter(
    (option) => option !== "HR" || canAssignHrLevel || admin,
  );

  const [level, setLevel] = useState<Level>(
    node?.level ?? (adding && editor.user ? "MEMBER" : levelOptions[0]),
  );
  const [department, setDepartment] = useState(
    node?.department ??
      (level === "HR"
        ? "HR"
        : parent && parent.level !== "CEO"
          ? parent.department
          : "PRODUCT"),
  );
  const [memberRole, setMemberRole] = useState<MemberRole>(
    node?.roleKeys?.includes(USER_ROLES.EMPLOYEE)
      ? "EMPLOYEE"
      : node
        ? node.employmentType ??
          (node.roleKeys.includes(USER_ROLES.EMPLOYEE)
            ? "EMPLOYEE"
            : memberRoleFor(node.userId.roles))
        : "INTERN",
  );
  const [roleKeys, setRoleKeys] = useState<string[]>(() =>
    node?.roleKeys?.length
      ? node.roleKeys
      : [
          hierarchyRoleKey(
            node?.level ?? level,
            node?.department ?? department,
            memberRole,
          ),
        ],
  );
  const [allCompanyAccess, setAllCompanyAccess] = useState(
    () => node?.allCompanyAccess ?? false,
  );
  const [roleKeysBeforeAll, setRoleKeysBeforeAll] = useState<string[] | null>(
    null,
  );
  const [levelSelection, setLevelSelection] = useState(() => {
    const customRole = roleCatalog?.customRoles.find(
      (role) =>
        node?.roleKeys?.includes(role.key) &&
        customRoleHierarchyLevel(role) === node.level,
    );
    return (
      customRole?.key ??
      node?.level ??
      (adding && editor.user ? "MEMBER" : levelOptions[0])
    );
  });
  const [reportsTo, setReportsTo] = useState(
    node?.reportsTo?._id ??
      parent?.userId._id ??
      (isExecutive
        ? (myId ?? "")
        : (items.find((item) => item.level === "CEO")?.userId._id ?? "")),
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState<OrganizationUser[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [searching, setSearching] = useState(adding);
  const [selected, setSelected] = useState<OrganizationUser | null>(
    adding ? (editor.user ?? null) : null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const departmentLocked =
    ownAssignment ||
    !structureAdmin ||
    level === "CEO" ||
    level === "HR" ||
    (!isExecutive &&
      ((adding && parent !== null && parent.level !== "CEO") ||
        (Boolean(node) && locked)));
  const needsSupervisor =
    (isExecutive && level !== "CEO") ||
    level === "MANAGER" ||
    level === "MEMBER";
  const targetId = node?.userId._id ?? selected?._id;
  const supervisorOptions = items.filter(
    (item) =>
      (isExecutive ||
        (level === "HR"
          ? item.level === "CEO"
          : item.department === department &&
            item.level === PREVIOUS_LEVEL[level])) &&
      item.userId._id !== targetId,
  );
  const supervisor =
    (isExecutive && reportsTo === myId) ||
    supervisorOptions.some((item) => item.userId._id === reportsTo)
      ? reportsTo
      : "";
  const ceo = items.find((item) => item.level === "CEO");
  const requiredRoleKey = hierarchyRoleKey(level, department, memberRole);
  const roleOptions = roleCatalog?.builtInRoles ?? [
    { key: requiredRoleKey, name: requiredRoleKey.replaceAll("_", " ") },
  ];
  const assignedIds = useMemo(
    () => new Set(items.map((item) => item.userId._id)),
    [items],
  );

  function roleBindingFitsPosition(
    binding: string,
    nextLevel: Level,
    nextDepartment: string,
  ) {
    if (binding === USER_ROLES.ADMIN) return isExecutive;
    if (binding === "HR") return nextLevel === "HR" && nextDepartment === "HR";
    if (binding === USER_ROLES.CEO) return nextLevel === "CEO";
    if (binding === USER_ROLES.HEAD) return nextLevel === "HEAD";
    if (binding === USER_ROLES.MANAGER) return nextLevel === "MANAGER";
    if (binding.endsWith("_HEAD"))
      return nextLevel === "HEAD" && binding === `${nextDepartment}_HEAD`;
    if (binding.endsWith("_MANAGER"))
      return nextLevel === "MANAGER" && binding === `${nextDepartment}_MANAGER`;
    return true;
  }

  function roleFitsCurrentPosition(key: string) {
    if (isExecutive) return true;
    const customRole = roleCatalog?.customRoles.find((role) => role.key === key);
    const hierarchyLevel = customRole ? customRoleHierarchyLevel(customRole) : null;
    if (hierarchyLevel && hierarchyLevel !== level) return false;
    const bindings = customRole?.roleBindings ?? [key];
    return bindings.every((binding) =>
      roleBindingFitsPosition(binding, level, department),
    );
  }

  const customRoleOptions = (roleCatalog?.customRoles ?? []).filter((role) => {
    const roleLevel = customRoleHierarchyLevel(role);
    const boundDepartments = DEPARTMENTS.filter(
      (candidate) =>
        role.roleBindings.includes(`${candidate}_HEAD`) ||
        role.roleBindings.includes(`${candidate}_MANAGER`),
    );
    return (
      role.isActive !== false &&
      !role.isTemplate &&
      roleLevel !== null &&
      levelOptions.includes(roleLevel) &&
      boundDepartments.length <= 1
    );
  });

  function updatePosition(
    nextLevel: Level,
    nextDepartment: string,
    nextMemberRole: MemberRole,
  ) {
    if (nextLevel === "HR") nextDepartment = "HR";
    const previousRequiredRole = hierarchyRoleKey(
      level,
      department,
      memberRole,
    );
    const nextRequiredRole = hierarchyRoleKey(
      nextLevel,
      nextDepartment,
      nextMemberRole,
    );
    setLevel(nextLevel);
    setLevelSelection(nextLevel);
    setDepartment(nextDepartment);
    setMemberRole(nextMemberRole);
    const nextRoleKeys = [
      ...new Set([
        ...roleKeys.filter((key) => {
          if (key === previousRequiredRole) return false;
          if (isExecutive) return true;
          const bindings = roleCatalog?.customRoles.find(
            (role) => role.key === key,
          )?.roleBindings ?? [key];
          return bindings.every((binding) =>
            roleBindingFitsPosition(binding, nextLevel, nextDepartment),
          );
        }),
        nextRequiredRole,
      ]),
    ];
    setRoleKeys(nextRoleKeys);
    if (allCompanyAccess) setRoleKeysBeforeAll(nextRoleKeys);
  }

  useEffect(() => {
    if (!adding) return;
    let active = true;
    const timer = window.setTimeout(() => {
      OrganizationService.users(search.trim(), page, "", companyId)
        .then((result) => {
          if (!active) return;
          setCandidates(result.users);
          setTotalPages(Math.max(1, result.pagination.totalPages));
        })
        .catch(() => {
          if (active) setCandidates([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [adding, companyId, page, search]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  function eligible(user: OrganizationUser) {
    const selfBootstrap =
      adding &&
      level === "CEO" &&
      user._id === myId &&
      !assignedIds.has(user._id) &&
      isExecutive;
    if (
      assignedIds.has(user._id) ||
      (user._id === myId && !selfBootstrap) ||
      (user.status && user.status !== "ACTIVE")
    )
      return false;
    if (!admin && user.roles.includes(USER_ROLES.ADMIN)) return false;
    if (isHr && !canAssignHrLevel && user.roles.includes(USER_ROLES.CEO))
      return false;
    if (!structureAdmin && (level === "MANAGER" || level === "MEMBER"))
      return (
        !user.roles.includes(USER_ROLES.CEO) &&
        user.roles.some((role) => BASE_ROLES.has(role))
      );
    return true;
  }
  const available = candidates.filter(eligible);

  function toggleOrganizationRole(key: string) {
    if (allCompanyAccess) return;
    if (key === USER_ROLES.CEO && isExecutive && !roleKeys.includes(key)) {
      updatePosition("CEO", department, memberRole);
      return;
    }
    setRoleKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function toggleAllCompanyRoles() {
    if (allCompanyAccess) {
      setAllCompanyAccess(false);
      if (roleKeysBeforeAll) setRoleKeys(roleKeysBeforeAll);
      setRoleKeysBeforeAll(null);
      return;
    }
    setRoleKeysBeforeAll(roleKeys);
    setAllCompanyAccess(true);
  }

  async function save() {
    if (!targetId) return;
    const incompatibleRole = roleKeys.find(
      (key) => key.startsWith("custom:") && !roleFitsCurrentPosition(key),
    );
    if (incompatibleRole) {
      const roleName = roleCatalog?.customRoles.find((role) => role.key === incompatibleRole)?.name ?? incompatibleRole;
      setError(`${roleName} does not match this reporting position. Choose a compatible role or update its hierarchy bindings.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const assignment = await OrganizationService.assign({
        userId: targetId,
        level,
        department,
        memberRole: level === "MEMBER" ? memberRole : undefined,
        roleKeys: [
          ...new Set([
            ...roleKeys.filter(roleFitsCurrentPosition),
            requiredRoleKey,
          ]),
        ],
        allCompanyAccess,
        reportsTo: needsSupervisor ? supervisor : undefined,
      }, companyId);
      const name = assignment.userId.name;
      onSaved(
        assignment,
        adding
          ? `${name} was added as ${LEVEL_LABEL[level].toLowerCase()}.`
          : `${name}'s role was updated.`,
      );
    } catch (caught) {
      setError(errorText(caught, "The change could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  const title = adding
    ? parent
      ? `Add to ${parent.userId.name}'s team`
      : "Add to the organization"
    : `Edit ${node!.userId.name}`;
  const ownerText =
    level === "CEO"
      ? "Top of the organization"
      : level === "HR"
        ? ceo
          ? `Reports to CEO ${ceo.userId.name}`
          : "Reports to the CEO once one is assigned"
        : level === "HEAD"
          ? ceo && ceo.userId._id !== targetId
            ? `Reports to CEO ${ceo.userId.name}`
            : "Reports to the CEO once one is assigned"
          : !structureAdmin
            ? "Reports to you"
            : "";
  const canSave =
    Boolean(targetId) &&
    !saving &&
    (!needsSupervisor || Boolean(supervisor)) &&
    levelOptions.includes(level);

  return createPortal(
    <div
      className="dashboard-shell fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/50 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-editor-title"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_28px_80px_rgba(15,23,42,0.3)] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#e8edf3] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-sm font-bold text-[#1645a2]">
              {node ? initials(node.userId.name) : <UserPlus size={18} />}
            </span>
            <div className="min-w-0">
              <h2
                id="org-editor-title"
                className="truncate text-base font-bold text-[#172033]"
              >
                {title}
              </h2>
              <p className="truncate text-xs text-[#71829e]">
                {node
                  ? `${roleTitle(node)} · ${node.userId.email}`
                  : parent
                    ? `New ${LEVEL_LABEL[levelOptions[0]].toLowerCase()} reporting to ${parent.userId.name}`
                    : "Place a CEO or a department head"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-[#71829e] hover:bg-[#f1f5f9]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {adding ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#71829e]">
                Choose an account
              </p>
              <label className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-[#dfe6ee] bg-[#fbfcfe] px-3 text-[#94a3b8] focus-within:border-[#1645a2] focus-within:ring-3 focus-within:ring-[#1645a2]/10">
                <Search size={15} />
                <input
                  autoFocus
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                    setSearching(true);
                  }}
                  placeholder="Search by name or email"
                  aria-label="Search accounts"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#172033] outline-none"
                />
              </label>
              <div
                role="radiogroup"
                aria-label="Accounts"
                className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-lg"
              >
                {searching ? (
                  <p className="flex items-center gap-2 px-2 py-4 text-sm text-[#71829e]">
                    <LoaderCircle size={15} className="animate-spin" />{" "}
                    Searching…
                  </p>
                ) : null}
                {!searching && !available.length ? (
                  <p className="px-2 py-4 text-sm text-[#71829e]">
                    No unassigned accounts match.{" "}
                    {level === "MEMBER"
                      ? "Use “Add team member” to create a new account."
                      : ""}
                  </p>
                ) : null}
                {!searching
                  ? available.map((user) => (
                      <button
                        key={user._id}
                        type="button"
                        role="radio"
                        aria-checked={selected?._id === user._id}
                        onClick={() => setSelected(user)}
                        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${selected?._id === user._id ? "border-[#1645a2] bg-[#eef4ff]" : "border-transparent hover:bg-[#f6f8fb]"}`}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-xs font-bold text-[#475569]">
                          {initials(user.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#172033]">
                            {user.name}
                          </span>
                          <span className="block truncate text-xs text-[#71829e]">
                            {user.email}
                            {user.workingRole ? ` · ${user.workingRole}` : ""}
                          </span>
                        </span>
                        {selected?._id === user._id ? (
                          <span
                            className="size-2.5 rounded-full bg-[#1645a2]"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                    ))
                  : null}
              </div>
              {totalPages > 1 ? (
                <div className="mt-2 flex items-center justify-end gap-2 text-xs text-[#71829e]">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((value) => value - 1);
                      setSearching(true);
                    }}
                    aria-label="Previous accounts"
                    className="flex size-8 items-center justify-center rounded-md border border-[#dfe6ee] disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span>
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => {
                      setPage((value) => value + 1);
                      setSearching(true);
                    }}
                    aria-label="Next accounts"
                    className="flex size-8 items-center justify-center rounded-md border border-[#dfe6ee] disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role level">
              <select
                value={levelSelection}
                disabled={levelOptions.length + customRoleOptions.length < 2}
                onChange={(event) => {
                  const value = event.target.value;
                  const customRole = roleCatalog?.customRoles.find(
                    (role) => role.key === value,
                  );
                  if (customRole) {
                    const nextLevel = customRoleHierarchyLevel(customRole);
                    if (!nextLevel) return;
                    const boundDepartment = DEPARTMENTS.find(
                      (candidate) =>
                        customRole.roleBindings.includes(`${candidate}_HEAD`) ||
                        customRole.roleBindings.includes(
                          `${candidate}_MANAGER`,
                        ),
                    );
                    const nextDepartment = boundDepartment ?? department;
                    if (
                      !customRole.roleBindings.every((binding) =>
                        roleBindingFitsPosition(
                          binding,
                          nextLevel,
                          nextDepartment,
                        ),
                      )
                    )
                      return;
                    updatePosition(nextLevel, nextDepartment, memberRole);
                    setLevelSelection(customRole.key);
                    setRoleKeys((current) => [
                      ...new Set([...current, customRole.key]),
                    ]);
                  } else {
                    updatePosition(value as Level, department, memberRole);
                  }
                }}
                className={selectClass}
              >
                {levelOptions.map((option) => (
                  <option key={option} value={option}>
                    {LEVEL_LABEL[option]}
                  </option>
                ))}
                {customRoleOptions.map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Field>
            {level !== "CEO" ? (
              <Field label="Department">
                <select
                  value={department}
                  disabled={departmentLocked}
                  onChange={(event) =>
                    updatePosition(level, event.target.value, memberRole)
                  }
                  className={selectClass}
                >
                  {DEPARTMENTS.map((option) => (
                    <option key={option} value={option}>
                      {titleCase(option)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {level === "MEMBER" ? (
              <Field label="Member type">
                <select
                  value={memberRole}
                  onChange={(event) =>
                    updatePosition(
                      level,
                      department,
                      event.target.value as MemberRole,
                    )
                  }
                  className={selectClass}
                >
                  <option value="INTERN">Intern</option>
                  <option value="EMPLOYEE">Employee</option>
                </select>
              </Field>
            ) : null}
            {structureAdmin ? (
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-[#71829e]">
                  Organisation roles
                </p>
                <div
                  role="group"
                  aria-label="Organisation roles"
                  className="grid max-h-44 gap-1.5 overflow-y-auto rounded-lg border border-[#dfe6ee] p-2 sm:grid-cols-2"
                >
                  {roleOptions.map(({ key, name }) => (
                    <label
                      key={key}
                      className="flex min-h-9 items-center gap-2 rounded-md px-2 text-xs text-[#344054] hover:bg-[#f5f7fa]"
                    >
                      <input
                        type="checkbox"
                        checked={
                          allCompanyAccess ||
                          roleKeys.includes(key) ||
                          key === requiredRoleKey
                        }
                        disabled={
                          allCompanyAccess ||
                          key === requiredRoleKey ||
                          !roleFitsCurrentPosition(key)
                        }
                        onChange={() => toggleOrganizationRole(key)}
                        className="accent-[#1d514f]"
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                  {roleCatalog?.customRoles
                    .filter(
                      (role) => role.isActive !== false && !role.isTemplate,
                    )
                    .map(({ key, name }) => (
                      <label
                        key={key}
                        className="flex min-h-9 items-center gap-2 rounded-md px-2 text-xs text-[#344054] hover:bg-[#f5f7fa]"
                      >
                        <input
                          type="checkbox"
                          checked={allCompanyAccess || roleKeys.includes(key)}
                          disabled={
                            allCompanyAccess || !roleFitsCurrentPosition(key)
                          }
                          onChange={() => toggleOrganizationRole(key)}
                          className="accent-[#1d514f]"
                        />
                        <span>{name}</span>
                      </label>
                    ))}
                </div>
                {roleCatalog?.canGrantAllCompanyRoles ? (
                    <button
                      type="button"
                      aria-pressed={allCompanyAccess}
                      onClick={toggleAllCompanyRoles}
                      className={`mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition ${
                        allCompanyAccess
                          ? "border-[#1645a2] bg-[#edf3ff] text-[#1645a2]"
                          : "border-[#dfe6ee] bg-white text-[#52627a] hover:bg-[#f5f7fa]"
                      }`}
                    >
                      {allCompanyAccess
                        ? "All company roles selected · Click to clear"
                        : "Select all company roles"}
                    </button>
                ) : null}
                {allCompanyAccess ? (
                    <p role="status" className="mt-1.5 text-xs text-[#1645a2]">
                      All roles and permissions for this company will be granted when you save.
                    </p>
                ) : null}
              </div>
            ) : null}
            {needsSupervisor ? (
              <Field
                label={
                  isExecutive
                    ? "Reports to (any active supervisor)"
                    : `Reports to (${LEVEL_LABEL[PREVIOUS_LEVEL[level]!].toLowerCase()})`
                }
              >
                <select
                  value={supervisor}
                  disabled={ownAssignment}
                  onChange={(event) => setReportsTo(event.target.value)}
                  className={selectClass}
                >
                  <option value="">Select a supervisor</option>
                  {isExecutive &&
                  myId &&
                  !supervisorOptions.some(
                    (item) => item.userId._id === myId,
                  ) ? (
                    <option value={myId}>Myself</option>
                  ) : null}
                  {supervisorOptions.map((item) => (
                    <option key={item.userId._id} value={item.userId._id}>
                      {item.userId.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Reports to">
                <p className="flex h-11 items-center rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 text-sm text-[#52637d]">
                  {ownerText}
                </p>
              </Field>
            )}
          </div>

          {locked ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {node!.userId.name} has active reports, so their level and
              department are locked. Move or remove those reports first.
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-[#e8edf3] bg-[#f8fafc] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {node ? (
            <button
              type="button"
              onClick={() => onViewProfile(node.userId._id)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#1645a2] hover:bg-[#eef4ff]"
            >
              <IdCard size={16} /> View profile
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 flex-1 rounded-lg border border-[#dfe6ee] bg-white px-4 text-sm font-semibold text-[#475569] hover:bg-[#f1f5f9] sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1645a2] px-5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(22,69,162,0.2)] transition hover:bg-[#123982] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {saving ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : null}
              {adding ? "Add to organization" : "Save changes"}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

const selectClass =
  "h-11 w-full rounded-lg border border-[#dfe6ee] bg-white px-3 text-sm text-[#172033] outline-none transition focus:border-[#1645a2] focus:ring-3 focus:ring-[#1645a2]/10 disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#94a3b8]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-[#71829e]">
        {label}
      </span>
      {children}
    </label>
  );
}
