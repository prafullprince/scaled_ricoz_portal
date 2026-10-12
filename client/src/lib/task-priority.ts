export type TaskPriorityTier = "P1" | "P2" | "P3";
export type TaskPriorityValue = TaskPriorityTier | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const taskPriorityOptions: Array<{ value: TaskPriorityTier; label: string }> = [
  { value: "P1", label: "P1 — Urgent" },
  { value: "P2", label: "P2 — High" },
  { value: "P3", label: "P3 — Normal" },
];

export function taskPriorityTier(value?: string | null): TaskPriorityTier | null {
  switch (value?.toUpperCase()) {
    case "P1":
    case "URGENT":
      return "P1";
    case "P2":
    case "HIGH":
    case "MEDIUM":
      return "P2";
    case "P3":
    case "LOW":
      return "P3";
    default:
      return null;
  }
}
