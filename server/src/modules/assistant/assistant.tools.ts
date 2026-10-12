import { tool, type Tool } from "@openai/agents";
import { z } from "zod";
import {
  Attendance,
  LeaveRequest,
  MarketingCampaign,
  Opportunity,
  OpportunityStatus,
  OrganizationAssignment,
  Task,
  TaskStatus,
  User,
} from "../../models/index.js";
import { UserStatus } from "../auth/authorization.js";
import { Types } from "mongoose";

export type AssistantContext = {
  userId: string;
  email: string;
  roles: string[];
  canReadHr: boolean;
  hrVisibleUserIds: string[] | null;
  marketingScope: "NONE" | "OWN" | "TEAM" | "DEPARTMENT";
  marketingVisibleUserIds: string[] | null;
};

const serialize = (value: unknown) => JSON.stringify(value);

export function createAssistantTools(context: AssistantContext) {
  const hrUserIds = context.hrVisibleUserIds?.map((id) => new Types.ObjectId(id));
  const hrUserFilter = hrUserIds ? { userId: { $in: hrUserIds } } : {};
  const hrAccountFilter = hrUserIds ? { _id: { $in: hrUserIds } } : {};
  const tools: Tool<AssistantContext>[] = [
    tool({
      name: "get_my_active_tasks",
      description:
        "Get the signed-in user's pending assigned tasks. Read-only.",
      parameters: z.object({
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ limit }) =>
        serialize(
          await Task.find({
            assignedTo: context.userId,
            status: TaskStatus.PENDING,
          })
            .select("title description deadline priority workflowStage")
            .sort({ deadline: 1 })
            .limit(limit)
            .lean(),
        ),
    }),
    tool({
      name: "get_my_leave_requests",
      description:
        "Get only the signed-in user's own leave requests. Read-only.",
      parameters: z.object({
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ limit }) =>
        serialize(
          await LeaveRequest.find({ userId: context.userId })
            .select("type startDate endDate days reason status createdAt")
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean(),
        ),
    }),
    tool({
      name: "get_open_positions",
      description: "Get published job and internship openings. Read-only.",
      parameters: z.object({
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ limit }) =>
        serialize(
          await Opportunity.find({ status: OpportunityStatus.PUBLISHED })
            .select("title type category workMode location applicationDeadline")
            .sort({ publishedAt: -1 })
            .limit(limit)
            .lean(),
        ),
    }),
  ];
  if (context.canReadHr) tools.push(
    tool({
      name: "get_hr_workforce_summary",
      description:
        "Get active workforce totals and department headcount for authorized HR leaders. Read-only.",
      parameters: z.object({}),
      execute: async () => {
        const [totalEmployees, assignments] = await Promise.all([
          User.countDocuments({
            ...hrAccountFilter,
            status: UserStatus.ACTIVE,
            roles: { $in: ["EMPLOYEE", "INTERN"] },
          } as any),
          OrganizationAssignment.aggregate<{ _id: string; count: number }>([
            { $match: { active: true, ...hrUserFilter } },
            { $group: { _id: "$department", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ]),
        ]);
        return serialize({
          totalEmployees,
          departments: assignments.map((item) => ({
            department: item._id,
            count: item.count,
          })),
        });
      },
    }),
    tool({
      name: "get_hr_attendance_summary",
      description:
        "Get attendance status totals for one date for authorized HR leaders. Read-only.",
      parameters: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
      execute: async ({ date }) =>
        serialize(
          await Attendance.aggregate<{ _id: string; count: number }>([
            { $match: { date, ...hrUserFilter } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ]),
        ),
    }),
    tool({
      name: "get_hr_leave_summary",
      description:
        "Get leave counts and optionally names for a date or status. Authorized HR leaders only. Read-only.",
      parameters: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
        includeNames: z.boolean().default(false),
      }),
      execute: async ({ date, status, includeNames }) => {
        const filter = {
          ...hrUserFilter,
          ...(status ? { status } : {}),
          ...(date
            ? { startDate: { $lte: date }, endDate: { $gte: date } }
            : {}),
        };
        const requests = await LeaveRequest.find(filter as any)
          .select("userId type startDate endDate days status")
          .populate("userId", "name")
          .limit(100)
          .lean();
        const byStatus = requests.reduce<Record<string, number>>(
          (counts, request) => ({
            ...counts,
            [request.status]: (counts[request.status] ?? 0) + 1,
          }),
          {},
        );
        return serialize({
          total: requests.length,
          byStatus,
          ...(includeNames
            ? {
                people: requests.map((request: any) => ({
                  name: request.userId?.name ?? "Unknown",
                  type: request.type,
                  status: request.status,
                  startDate: request.startDate,
                  endDate: request.endDate,
                })),
              }
            : {}),
        });
      },
    }),
    tool({
      name: "search_hr_employee_directory",
      description:
        "Search active employees by name or email for authorized HR leaders. Read-only and limited to 25 results.",
      parameters: z.object({
        query: z.string().trim().max(100).default(""),
        limit: z.number().int().min(1).max(25).default(10),
      }),
      execute: async ({ query, limit }) => {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const filter = {
          status: UserStatus.ACTIVE,
          ...hrAccountFilter,
          roles: { $in: ["EMPLOYEE", "INTERN"] },
          ...(query
            ? {
                $or: [
                  { name: new RegExp(escaped, "i") },
                  { email: new RegExp(escaped, "i") },
                ],
              }
            : {}),
        } as any;
        return serialize(
          await User.find(filter)
            .select("name email roles status")
            .sort({ name: 1 })
            .limit(limit)
            .lean(),
        );
      },
    }),
  );
  if (context.marketingScope !== "NONE") {
    tools.push(tool({
      name: "get_marketing_campaigns",
      description: "Get campaigns visible to the signed-in Marketing user. Read-only.",
      parameters: z.object({ status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]).optional(), limit: z.number().int().min(1).max(25).default(10) }),
      execute: async ({ status, limit }) => {
        const visibleIds = context.marketingVisibleUserIds;
        const filter = { ...(status ? { status } : {}), ...(visibleIds ? { $or: [{ ownerId: { $in: visibleIds } }, { teamMemberIds: { $in: visibleIds } }] } : {}) } as any;
        return serialize(await MarketingCampaign.find(filter).select("name objective channels status budget spend leads conversions revenue startDate endDate").sort({ startDate: -1 }).limit(limit).lean());
      },
    }));
  }
  return tools;
}
