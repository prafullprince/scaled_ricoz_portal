export type DemoAccountGroup = "hq" | "employees" | "external";

export type DemoAccount = {
  name: string;
  email: string;
  password: string;
  designation: string;
  department: string;
  group: DemoAccountGroup;
  roles: string[];
  initials: string;
  color: string;
  featured?: boolean;
};

const password = "Demo@12345";
const domain = "ricoz.demo";
const colors: Record<string, string> = {
  Executive: "#1746a2",
  Product: "#0f766e",
  Marketing: "#7b35e8",
  Finance: "#e98200",
  Sales: "#10a64a",
  Projects: "#0793c7",
  Support: "#0891b2",
  HR: "#7c3aed",
  Design: "#8c55ed",
  Engineering: "#2563eb",
  IT: "#0f766e",
  External: "#64748b",
};
const label = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => word === "it" ? "IT" : word[0].toUpperCase() + word.slice(1))
    .join(" ");
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const account = (
  input: Omit<DemoAccount, "password" | "initials" | "color">,
): DemoAccount => ({
  ...input,
  password,
  initials: initials(input.name),
  color: colors[input.department] ?? colors.External,
});

const departments = [
  "PRODUCT",
  "MARKETING",
  "FINANCE",
  "SALES",
  "PROJECTS",
  "SUPPORT",
  "HR",
  "DESIGN",
  "ENGINEERING",
  "IT",
] as const;
const roleAccounts = [
  "USER",
  "CUSTOMER",
  "INVESTOR",
  "INTERN",
  "EMPLOYEE",
  "HR",
  "CEO",
  "CFO",
  "HEAD",
  "MANAGER",
  ...departments.flatMap((department) => [
    `${department}_HEAD`,
    `${department}_MANAGER`,
  ]),
  "ADMIN",
];

const roleDemoAccounts = roleAccounts.map((role): DemoAccount => {
  const departmentKey = departments.find((department) =>
    role.startsWith(`${department}_`),
  );
  const department = departmentKey
    ? label(departmentKey)
    : role === "HR"
      ? "HR"
      : role === "CFO"
        ? "Finance"
        : ["USER", "CUSTOMER", "INVESTOR"].includes(role)
      ? "External"
      : "Executive";
  const group: DemoAccountGroup = ["USER", "CUSTOMER", "INVESTOR"].includes(
    role,
  )
    ? "external"
    : ["INTERN", "EMPLOYEE"].includes(role)
      ? "employees"
      : "hq";
  const name = `Demo ${label(role)}`;
  return account({
    name,
    email: `demo.${role.toLowerCase().replaceAll("_", ".")}@${domain}`,
    designation: label(role),
    department,
    group,
    roles: role === "USER" ? ["USER"] : ["USER", role],
    featured: [
      "ADMIN",
      "CEO",
      "MARKETING_HEAD",
      "SALES_HEAD",
      "HR_HEAD",
      "PRODUCT_HEAD",
      "ENGINEERING_HEAD",
      "IT_HEAD",
    ].includes(role),
  });
});

const coreMembers = departments.flatMap((department) =>
  (["employee", "intern"] as const).map((memberType) => {
    const role = memberType === "employee" ? "EMPLOYEE" : "INTERN";
    const departmentName = label(department);
    return account({
      name: `Demo ${label(role)} · ${departmentName}`,
      email: `demo.${department.toLowerCase()}.${memberType}@${domain}`,
      designation: `${departmentName} ${label(role)}`,
      department: departmentName,
      group: "employees",
      roles: ["USER", role],
    });
  }),
);

const specialists = [
  [
    "marketing.content.employee",
    "Demo Content Specialist",
    "Marketing",
    "EMPLOYEE",
  ],
  [
    "marketing.performance.intern",
    "Demo Performance Marketing Intern",
    "Marketing",
    "INTERN",
  ],
  [
    "marketing.social.employee",
    "Demo Social Media Executive",
    "Marketing",
    "EMPLOYEE",
  ],
  [
    "sales.outbound.employee",
    "Demo Outbound Sales Executive",
    "Sales",
    "EMPLOYEE",
  ],
  ["sales.research.intern", "Demo Sales Research Intern", "Sales", "INTERN"],
] as const;

export const DEMO_ACCOUNTS: DemoAccount[] = [
  ...roleDemoAccounts,
  ...coreMembers,
  ...specialists.map(([slug, name, department, role]) =>
    account({
      name,
      email: `demo.${slug}@${domain}`,
      designation: name.replace(/^Demo /, ""),
      department,
      group: "employees",
      roles: ["USER", role],
    }),
  ),
];
