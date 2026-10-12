// Must match server/src/constants/jobRoles.ts — the fixed set of designations an intern/employee may self-select.
export const JOB_ROLES = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "UI/UX Designer",
] as const;

export type JobRole = (typeof JOB_ROLES)[number];
