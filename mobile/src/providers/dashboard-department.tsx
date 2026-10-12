import { createContext, useContext } from 'react';

export const DashboardDepartmentContext = createContext<{
  department: string | undefined;
  setDepartment: (department: string | undefined) => void;
} | null>(null);

export function useDashboardDepartment() {
  const context = useContext(DashboardDepartmentContext);
  if (!context) throw new Error('Dashboard department selection requires DashboardShell.');
  return context;
}