import { ApiError } from "../../utils/apiError.utils.js";

export interface ResolvedPeriod {
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const endOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
};

const previousWindow = (from: Date, to: Date) => {
  const lengthMs = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - lengthMs);
  return { previousFrom, previousTo };
};

/** Resolves `?period=` or `?from&to=` into concrete date windows, plus an equal-length previous window. */
export function resolvePeriod(query: { period?: string | undefined; from?: string | undefined; to?: string | undefined }): ResolvedPeriod {
  if (query.from && query.to) {
    const from = startOfDay(new Date(query.from));
    const to = endOfDay(new Date(query.to));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new ApiError(400, "Invalid date range");
    }
    if (from > to) {
      throw new ApiError(400, "'from' must be before or equal to 'to'");
    }
    return { from, to, ...previousWindow(from, to) };
  }

  const period = query.period === "quarterly" || query.period === "yearly" ? query.period : "monthly";
  const now = new Date();
  const to = endOfDay(now);
  let from: Date;
  if (period === "yearly") {
    from = new Date(now.getFullYear(), 0, 1);
  } else if (period === "quarterly") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    from = new Date(now.getFullYear(), quarterStartMonth, 1);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { from, to, ...previousWindow(from, to) };
}

export const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const periodPayload = (period: ResolvedPeriod) => ({
  from: toDateOnly(period.from),
  to: toDateOnly(period.to),
});
