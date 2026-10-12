// The fixed set of designations an intern/employee may switch their current role to.
export const JOB_ROLES = [
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "UI/UX Designer",
] as const;

export type JobRole = (typeof JOB_ROLES)[number];
