import { Boxes, Megaphone, Landmark, Handshake, FolderKanban, Headphones, Users, Palette, Code2, Server } from "lucide-react";

export const DEPARTMENTS = [
  { id: "PRODUCT", label: "Product", icon: Boxes },
  { id: "MARKETING", label: "Marketing", icon: Megaphone },
  { id: "FINANCE", label: "Finance", icon: Landmark },
  { id: "SALES", label: "Sales", icon: Handshake },
  { id: "PROJECTS", label: "Projects", icon: FolderKanban },
  { id: "SUPPORT", label: "Support", icon: Headphones },
  { id: "HR", label: "HR", icon: Users },
  { id: "DESIGN", label: "Design", icon: Palette },
  { id: "ENGINEERING", label: "Engineering", icon: Code2 },
  { id: "IT", label: "IT Department", icon: Server },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]["id"];
export type WorkspaceId = DepartmentId | "PERSONAL";

const routeDepartment = (pathname: string) =>
  DEPARTMENTS.find((department) => ["SALES", "MARKETING", "HR"].includes(department.id) && (pathname === `/dashboard/${department.id.toLowerCase()}` || pathname.startsWith(`/dashboard/${department.id.toLowerCase()}/`)));

export function selectedDepartment(pathname: string, requested: string | null): DepartmentId {
  return routeDepartment(pathname)?.id ?? DEPARTMENTS.find((department) => department.id === requested)?.id ?? "PRODUCT";
}

export function selectedWorkspace(pathname: string, requested: string | null): WorkspaceId {
  if (pathname === "/dashboard/executive" || pathname.startsWith("/dashboard/executive/") || pathname === "/dashboard/planner" || pathname === "/dashboard/my-work") {
    return "PERSONAL";
  }
  return routeDepartment(pathname)?.id ?? (requested === "PERSONAL" ? "PERSONAL" : selectedDepartment(pathname, requested));
}

export function departmentHref(pathname: string, department: string) {
  return `${pathname}?department=${encodeURIComponent(department)}`;
}

export function departmentDashboard(department: WorkspaceId) {
  if (department === "PERSONAL") return departmentHref("/dashboard/executive", department);
  return departmentHref(["SALES", "MARKETING", "HR"].includes(department) ? `/dashboard/${department.toLowerCase()}` : "/dashboard", department);
}