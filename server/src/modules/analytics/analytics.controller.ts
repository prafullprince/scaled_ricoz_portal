import type { NextFunction, Request, Response } from "express";
import { resolvePeriod } from "./period.util.js";
import { AnalyticsService } from "./analytics.service.js";
import type { AnalyticsQueryDto } from "./analytics.validation.js";

/** Wraps a service call as `{ success, data }`, resolving the period from the validated query once. */
const handler = (compute: (period: ReturnType<typeof resolvePeriod>) => Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (res.locals.query ?? req.query) as AnalyticsQueryDto;
      const period = resolvePeriod(query);
      const data = await compute(period);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

export const getOverview = handler((period) => AnalyticsService.overview(period));
export const getArr = handler((period) => AnalyticsService.arr(period));
export const getMrr = handler((period) => AnalyticsService.mrr(period));
export const getTotalRevenue = handler((period) => AnalyticsService.totalRevenue(period));
export const getRevenueGrowth = handler((period) => AnalyticsService.revenueGrowth(period));
export const getActiveCustomers = handler((period) => AnalyticsService.activeCustomers(period));
export const getInvoiceVolume = handler((period) => AnalyticsService.invoiceVolume(period));
export const getCollectionRate = handler((period) => AnalyticsService.collectionRate(period));
export const getOutstandingRevenue = handler((period) => AnalyticsService.outstandingRevenue(period));
export const getGrr = handler((period) => AnalyticsService.grr(period));
export const getCac = handler((period) => AnalyticsService.cac(period));
export const getLtv = handler((period) => AnalyticsService.ltv(period));
export const getCashBurn = handler((period) => AnalyticsService.cashBurn(period));
export const getRunway = handler((period) => AnalyticsService.runway(period));
export const getDso = handler((period) => AnalyticsService.dso(period));
