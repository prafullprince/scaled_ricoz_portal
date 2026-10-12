"use client";

import { useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { OrganizationService, type OrganizationRoleCatalog, type OrganizationRoleDefinition } from "@/services/organization.service";

type Props = {
  catalog: OrganizationRoleCatalog;
  companyId: string;
  onCatalogChange: (catalog: OrganizationRoleCatalog) => void;
  onClose: () => void;
};
type CustomHierarchyLevel = "HEAD" | "MANAGER" | "MEMBER";
type PermissionTab = "ALL" | "CEO" | "HR" | "COMPLIANCE" | "MARKETING" | "SALES" | "PEOPLE" | "WORK" | "INVESTORS" | "CUSTOMERS" | "SERVICES" | "RECRUITMENT" | "OTHER";

const permissionTabLabels: Record<PermissionTab, string> = {
  ALL: "All features",
  CEO: "CEO",
  HR: "HR",
  COMPLIANCE: "Compliance",
  MARKETING: "Marketing",
  SALES: "Sales",
  PEOPLE: "People",
  WORK: "Work & tasks",
  INVESTORS: "Investors",
  CUSTOMERS: "Customers",
  SERVICES: "Services & products",
  RECRUITMENT: "Recruitment",
  OTHER: "Other",
};

function permissionTabForKey(key: string): Exclude<PermissionTab, "ALL" | "CEO" | "HR"> {
  if (key.startsWith("COMPLIANCE_")) return "COMPLIANCE";
  if (key.startsWith("MARKETING_")) return "MARKETING";
  if (key.startsWith("SALES_")) return "SALES";
  if (key.startsWith("INVESTOR_")) return "INVESTORS";
  if (key.startsWith("CUSTOMER_")) return "CUSTOMERS";
  if (key.startsWith("SERVICE_") || key.startsWith("PRODUCT_") || key === "CUSTOMER_SERVICE_READ") return "SERVICES";
  if (key.startsWith("RECRUITMENT_")) return "RECRUITMENT";
  if (["PROFILE_READ", "PROFILE_UPDATE", "ATTENDANCE_USE", "LEAVE_REQUEST", "LEAVE_ADMIN", "EMPLOYEE_READ", "EMPLOYEE_INTERNAL_ACCESS", "INTERN_READ"].includes(key)) return "PEOPLE";
  if (["INTERN_TASK_READ", "TASK_ASSIGN", "TASK_REPORT_READ"].includes(key)) return "WORK";
  return "OTHER";
}

function inferHierarchyLevel(role: OrganizationRoleDefinition | null): CustomHierarchyLevel | "" {
  if (!role) return "";
  if (role.hierarchyLevel) return role.hierarchyLevel;
  const levels = new Set<CustomHierarchyLevel>();
  for (const binding of role.roleBindings) {
    if (binding === "HEAD" || binding.endsWith("_HEAD")) levels.add("HEAD");
    else if (binding === "MANAGER" || binding.endsWith("_MANAGER")) levels.add("MANAGER");
    else if (binding === "INTERN" || binding === "EMPLOYEE") levels.add("MEMBER");
  }
  return levels.size === 1 ? [...levels][0] : "";
}

export function OrganizationRoleManager({ catalog, companyId, onCatalogChange, onClose }: Props) {
  const [editing, setEditing] = useState<OrganizationRoleDefinition | null>(catalog.customRoles[0] ?? null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roleBindings, setRoleBindings] = useState<string[]>([]);
  const [hierarchyLevel, setHierarchyLevel] = useState<CustomHierarchyLevel | "">(inferHierarchyLevel(catalog.customRoles[0] ?? null));
  const [parentRoleKey, setParentRoleKey] = useState("");
  const [inheritsPermissions, setInheritsPermissions] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [permissionTab, setPermissionTab] = useState<PermissionTab>("ALL");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateKey, setTemplateKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function editRole(role: OrganizationRoleDefinition | null) {
    setEditing(role);
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setPermissions(role?.permissions ?? []);
    setRoleBindings(role?.roleBindings ?? []);
    setHierarchyLevel(inferHierarchyLevel(role));
    setParentRoleKey(role?.parentRoleKey ?? "");
    setInheritsPermissions(role?.inheritsPermissions ?? false);
    setIsActive(role?.isActive !== false);
    setPermissionTab("ALL");
    setError("");
  }

  function toggle(values: string[], value: string, setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function toggleBinding(key: string) {
    const nextBindings = roleBindings.includes(key) ? roleBindings.filter((item) => item !== key) : [...roleBindings, key];
    setRoleBindings(nextBindings);
    const baseline = nextBindings.flatMap((role) => catalog.bindingPermissions[role] ?? []);
    setPermissions((current) => [...new Set([...current, ...baseline])]);
  }

  async function save() {
    const invalidBinding = roleBindings.find((binding) => {
      const bindingLevel = binding === "HEAD" || binding.endsWith("_HEAD")
        ? "HEAD"
        : binding === "MANAGER" || binding.endsWith("_MANAGER")
          ? "MANAGER"
          : binding === "INTERN" || binding === "EMPLOYEE"
            ? "MEMBER"
            : null;
      return bindingLevel !== null && hierarchyLevel !== "" && bindingLevel !== hierarchyLevel;
    });
    if (invalidBinding) {
      setError(`${invalidBinding.replaceAll("_", " ")} does not match the selected hierarchy level.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const baseline = roleBindings.flatMap((binding) => catalog.bindingPermissions[binding] ?? []);
      const role = await OrganizationService.saveRole({ name, description, permissions: [...new Set([...permissions, ...baseline])], roleBindings, hierarchyLevel: hierarchyLevel || null, parentRoleKey: parentRoleKey || null, inheritsPermissions, isActive }, editing?.key, companyId);
      const customRoles = editing
        ? catalog.customRoles.map((item) => item.key === role.key ? role : item)
        : [...catalog.customRoles, role].sort((left, right) => left.name.localeCompare(right.name));
      onCatalogChange({ ...catalog, customRoles });
      editRole(role);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The role could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const permissionSets = new Map<PermissionTab, Set<string>>();
  for (const permission of catalog.permissions) {
    const tab = permissionTabForKey(permission.key);
    const permissionsInTab = permissionSets.get(tab) ?? new Set<string>();
    permissionsInTab.add(permission.key);
    permissionSets.set(tab, permissionsInTab);
  }
  for (const tab of ["CEO", "HR"] as const) {
    const permissionsInTab = permissionSets.get(tab) ?? new Set<string>();
    for (const key of catalog.featurePermissions?.[tab] ?? []) permissionsInTab.add(key);
    permissionSets.set(tab, permissionsInTab);
  }
  const permissionTabs = (["ALL", "CEO", "HR", "COMPLIANCE", "MARKETING", "SALES", "PEOPLE", "WORK", "INVESTORS", "CUSTOMERS", "SERVICES", "RECRUITMENT", "OTHER"] as PermissionTab[]).filter(
    (tab) => tab === "ALL" || (permissionSets.get(tab)?.size ?? 0) > 0,
  );
  const visiblePermissions = permissionTab === "ALL"
    ? catalog.permissions
    : catalog.permissions.filter((permission) => permissionSets.get(permissionTab)?.has(permission.key));

  async function remove(role: OrganizationRoleDefinition) {
    if (!window.confirm(`Delete the ${role.name} role?`)) return;
    setError("");
    try {
      await OrganizationService.deleteRole(role.key, companyId);
      const customRoles = catalog.customRoles.filter((item) => item.key !== role.key);
      onCatalogChange({ ...catalog, customRoles });
      editRole(customRoles[0] ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The role could not be deleted.");
    }
  }

  function configureProjectManager() {
    const projectManager = catalog.customRoles.find(
      (role) => role.key === "custom:project-manager",
    );
    if (projectManager) {
      editRole(projectManager);
      return;
    }
    editRole(null);
    setName("Project Manager");
    setDescription("Company-scoped project management access.");
    setHierarchyLevel("MANAGER");
    setRoleBindings([]);
    setPermissions([]);
    setParentRoleKey("");
    setInheritsPermissions(false);
    setIsActive(true);
  }

  function loadTemplate(key: string) {
    setTemplateKey(key);
    const template = catalog.templates.find((item) => item.key === key);
    if (!template) return;
    editRole(null);
    setName(`${template.name} copy`.slice(0, 60));
    setDescription(template.description);
    setPermissions(template.permissions);
    setRoleBindings(template.roleBindings);
    setHierarchyLevel(inferHierarchyLevel(template));
    setParentRoleKey(template.parentRoleKey ?? "");
    setInheritsPermissions(template.inheritsPermissions ?? false);
  }

  async function saveTemplate() {
    setSavingTemplate(true);
    setError("");
    try {
      const baseline = roleBindings.flatMap((binding) => catalog.bindingPermissions[binding] ?? []);
      const template = await OrganizationService.saveRoleTemplate({
        name,
        description,
        permissions: [...new Set([...permissions, ...baseline])],
        roleBindings,
        hierarchyLevel: hierarchyLevel || null,
        parentRoleKey: parentRoleKey || null,
        inheritsPermissions,
        isTemplate: true,
      }, companyId);
      onCatalogChange({ ...catalog, templates: [...catalog.templates, template].sort((left, right) => left.name.localeCompare(right.name)) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The role template could not be saved.");
    } finally {
      setSavingTemplate(false);
    }
  }

  return (
    createPortal(<div className="fixed inset-0 z-70 flex h-dvh items-end justify-center bg-[#101820]/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="organization-roles-title" className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl border border-[#d8e0e7] bg-white shadow-2xl sm:rounded-xl">
        <header className="flex items-center justify-between border-b border-[#e3e8ed] px-5 py-4">
          <div>
            <h2 id="organization-roles-title" className="text-base font-bold text-[#172033]">Organisation roles</h2>
            <p className="mt-0.5 text-xs text-[#64748b]">Set permissions for custom roles in this organisation.</p>
          </div>
          <button type="button" aria-label="Close role manager" onClick={onClose} className="flex size-9 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f1f5f9]"><X size={18} /></button>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="max-h-36 overflow-y-auto border-b border-[#e3e8ed] p-3 md:max-h-none md:border-b-0 md:border-r">
            <button type="button" onClick={() => editRole(null)} className="mb-2 flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#1d514f] px-3 text-sm font-semibold text-white hover:bg-[#184543]"><Plus size={15} /> New role</button>
            {catalog.canManageProjectManager ? <button type="button" onClick={configureProjectManager} className="mb-2 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#cbd9ef] bg-[#f1f6ff] px-3 text-xs font-semibold text-[#1645a2] hover:bg-[#e6efff]"><Plus size={14} /> Configure Project Manager</button> : null}
            <ul className="space-y-1">
              {catalog.customRoles.map((role) => (
                <li key={role.key}>
                  <button type="button" aria-current={editing?.key === role.key} onClick={() => editRole(role)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${editing?.key === role.key ? "bg-[#eaf2f1] font-semibold text-[#184543]" : "text-[#334155] hover:bg-[#f4f6f8]"}`}>
                    <span className="block truncate">{role.name}</span>
                    <span className="mt-0.5 block text-xs font-normal text-[#64748b]">{role.permissions.length} permissions{role.isActive === false ? " · archived" : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#475569]">Role name
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0e7] px-3 text-sm font-normal text-[#172033] outline-none focus:border-[#1d514f]" placeholder="Founder" />
              </label>
              <label className="text-xs font-semibold text-[#475569]">Description
                <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0e7] px-3 text-sm font-normal text-[#172033] outline-none focus:border-[#1d514f]" placeholder="Optional role description" />
              </label>
            </div>
            <label className="mt-4 block text-xs font-semibold text-[#475569]">Hierarchy level
              <select value={hierarchyLevel} onChange={(event) => setHierarchyLevel(event.target.value as CustomHierarchyLevel | "")} className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0e7] bg-white px-3 text-sm font-normal text-[#172033] outline-none focus:border-[#1d514f] sm:max-w-sm">
                <option value="">No hierarchy access</option>
                <option value="HEAD">Department Head</option>
                <option value="MANAGER">Manager</option>
                <option value="MEMBER">Member</option>
              </select>
            </label>
            <p className="mt-1 text-xs text-[#64748b]">This sets where the role sits in the organization. Department and reports still limit what its holder can access.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="text-xs font-semibold text-[#475569]">Start from template
                <select value={templateKey} onChange={(event) => loadTemplate(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0e7] bg-white px-3 text-sm font-normal text-[#172033] outline-none focus:border-[#1d514f]">
                  <option value="">Choose a saved template</option>
                  {catalog.templates.map((template) => <option key={template.key} value={template.key}>{template.name}</option>)}
                </select>
              </label>
              <button type="button" disabled={savingTemplate || name.trim().length < 2} onClick={() => void saveTemplate()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#1d514f] px-3 text-sm font-semibold text-[#1d514f] hover:bg-[#eaf2f1] disabled:opacity-50"><Plus size={15} /> {savingTemplate ? "Saving template…" : "Save as template"}</button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-[#475569]">Inherit permissions from role
                <select value={parentRoleKey} onChange={(event) => setParentRoleKey(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-[#d8e0e7] bg-white px-3 text-sm font-normal text-[#172033] outline-none focus:border-[#1d514f]">
                  <option value="">No parent role</option>
                  {catalog.customRoles.filter((role) => role.key !== editing?.key && !role.isTemplate && role.isActive !== false).map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 self-end rounded-md border border-[#e3e8ed] px-3 py-2.5 text-xs text-[#334155]"><input type="checkbox" checked={inheritsPermissions} onChange={(event) => setInheritsPermissions(event.target.checked)} className="accent-[#1d514f]" />Inherit parent permissions</label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-[#334155]"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} disabled={!editing} className="accent-[#1d514f]" />Active and assignable</label>
            <fieldset className="mt-5">
              <legend className="text-xs font-bold uppercase text-[#475569]">Role-level access</legend>
              <p className="mt-1 text-xs text-[#64748b]">Select a department Head or Manager role to grant its hierarchy access. Assign this custom role at the matching organization level; access stays within that person’s department and reports.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {catalog.roleBindings.map((key) => (
                  <label key={key} className="flex items-start gap-2 rounded-md border border-[#e3e8ed] px-3 py-2 text-xs text-[#334155]">
                    <input type="checkbox" checked={roleBindings.includes(key)} onChange={() => toggleBinding(key)} className="mt-0.5 accent-[#1d514f]" />
                    <span>{key.replaceAll("_", " ")}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-5">
              <legend className="text-xs font-bold uppercase text-[#475569]">Permissions</legend>
              <div role="tablist" aria-label="Permission feature" className="mt-2 flex gap-1 overflow-x-auto border-b border-[#e3e8ed]">
                {permissionTabs.map((tab) => (
                  <button key={tab} type="button" role="tab" aria-selected={permissionTab === tab} onClick={() => setPermissionTab(tab)} className={`h-9 shrink-0 border-b-2 px-3 text-xs font-semibold ${permissionTab === tab ? "border-[#1d514f] text-[#1d514f]" : "border-transparent text-[#64748b] hover:text-[#172033]"}`}>
                    {permissionTabLabels[tab]}
                  </button>
                ))}
              </div>
              <div role="tabpanel" className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-md border border-[#e3e8ed] p-2 sm:grid-cols-2 lg:grid-cols-3">
                {visiblePermissions.map(({ key, name: label }) => (
                  <label key={key} className="flex items-start gap-2 rounded px-2 py-1.5 text-xs text-[#334155] hover:bg-[#f4f6f8]">
                    <input type="checkbox" checked={permissions.includes(key) || roleBindings.some((binding) => catalog.bindingPermissions[binding]?.includes(key))} disabled={roleBindings.some((binding) => catalog.bindingPermissions[binding]?.includes(key))} onChange={() => toggle(permissions, key, setPermissions)} className="mt-0.5 accent-[#1d514f]" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {error ? <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            <footer className="mt-4 flex items-center justify-between gap-2 border-t border-[#e3e8ed] pt-4">
              {editing ? <button type="button" onClick={() => void remove(editing)} className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-red-700 hover:bg-red-50"><Trash2 size={15} /> Delete role</button> : <span />}
              <button type="button" disabled={saving || name.trim().length < 2} onClick={() => void save()} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1d514f] px-4 text-sm font-semibold text-white hover:bg-[#184543] disabled:opacity-50"><Save size={15} /> {saving ? "Saving…" : editing ? "Save changes" : "Create role"}</button>
            </footer>
          </div>
        </div>
      </section>
    </div>, document.body)
  );
}