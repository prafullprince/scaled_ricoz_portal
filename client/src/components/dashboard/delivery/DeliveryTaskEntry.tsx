"use client";

import { useState, type ReactNode } from "react";
import { useAppSelector } from "@/redux/hooks";
import { useSelectedDepartment } from "../DepartmentRail";
import { EngineeringDeliveryWorkspace } from "./EngineeringDeliveryWorkspace";
import styles from "./EngineeringDeliveryWorkspace.module.css";
import { SalesAccountabilityWorkspace } from "../sales/SalesAccountabilityWorkspace";

export function DeliveryTaskEntry({ existing, department }: { existing: ReactNode; department?: string }) {
  const user = useAppSelector((state) => state.auth.user);
  const selectedDepartment = useSelectedDepartment();
  const [view, setView] = useState<"DELIVERY" | "EXISTING">("DELIVERY");
  const executive = user?.roles.some((role) => role === "CEO" || role === "ADMIN");
  const activeDepartment = department ?? (executive ? selectedDepartment : user?.organization_department);
  if (activeDepartment !== "ENGINEERING" && activeDepartment !== "PRODUCT" && activeDepartment !== "IT" && activeDepartment !== "SALES") return existing;
  return <div className={styles.workspace}>
    <div className={styles.toolbar}>
      <div className={styles.tabs}><button aria-pressed={view === "DELIVERY"} onClick={() => setView("DELIVERY")}>{activeDepartment === "SALES" ? "Sales targets & execution" : "Hierarchical delivery"}</button><button aria-pressed={view === "EXISTING"} onClick={() => setView("EXISTING")}>Existing tasks</button></div>
      <p className={styles.muted}>Existing tasks and reports remain available unchanged.</p>
    </div>
    {view === "DELIVERY" ? activeDepartment === "SALES" ? <SalesAccountabilityWorkspace /> : <EngineeringDeliveryWorkspace /> : existing}
  </div>;
}
