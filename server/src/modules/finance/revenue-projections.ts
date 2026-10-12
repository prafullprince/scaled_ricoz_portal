import type { IRevenueStream } from "../../models/finance-forecast.models.js";

export const FISCAL_MONTHS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep",
  "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
] as const;

export function mergeRevenueStreamsPreservingExisting(
  existing: readonly IRevenueStream[],
  submitted: readonly IRevenueStream[],
) {
  const streamsById = new Map(existing.map((stream) => [stream.streamId, stream]));
  for (const stream of submitted) streamsById.set(stream.streamId, stream);
  return [...streamsById.values()];
}

export function buildRevenueProjection(streams: readonly IRevenueStream[]) {
  const projectedStreams = streams.map((stream) => {
    const months = FISCAL_MONTHS.map((_, monthIndex) => {
      if (monthIndex < stream.startMonth || monthIndex > stream.endMonth) {
        return { units: 0, revenue: 0, margin: 0 };
      }
      const elapsedMonths = monthIndex - stream.startMonth;
      const units = Number((stream.baseUnits * (
        stream.growthType === "MULTIPLIER" ? stream.growthMultiplier ** elapsedMonths : 1
      )).toFixed(2));
      const revenue = units * stream.unitRevenue;
      return {
        units,
        revenue,
        margin: revenue * stream.marginPercent / 100,
      };
    });
    return {
      ...stream,
      months,
      annualRevenue: months.reduce((sum, month) => sum + month.revenue, 0),
      annualMargin: months.reduce((sum, month) => sum + month.margin, 0),
    };
  });
  const monthlyTotals = FISCAL_MONTHS.map((_, monthIndex) =>
    projectedStreams.reduce((total, stream) => {
      const month = stream.months[monthIndex];
      if (!month) throw new Error(`Revenue projection is missing month ${monthIndex}`);
      return {
        revenue: total.revenue + month.revenue,
        units: total.units + month.units,
        margin: total.margin + month.margin,
      };
    }, { revenue: 0, units: 0, margin: 0 }),
  );
  const annualRevenue = monthlyTotals.reduce((sum, month) => sum + month.revenue, 0);
  const annualMargin = monthlyTotals.reduce((sum, month) => sum + month.margin, 0);
  return {
    months: FISCAL_MONTHS,
    streams: projectedStreams,
    monthlyTotals,
    annualRevenue,
    annualMargin,
    grossMarginPercent: annualRevenue ? annualMargin / annualRevenue * 100 : 0,
    activeStreams: streams.length,
  };
}
