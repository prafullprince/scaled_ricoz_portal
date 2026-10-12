import type { NextFunction, Request, Response } from "express";
import { CostPlan, ResourcePlan, RevenueForecast } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { buildInvestorFinancialPlan } from "./investor-financial-plan.js";

export async function getInvestorFinancialPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const fiscalYearStart = Number(req.params.fiscalYearStart);
    if (!Number.isInteger(fiscalYearStart) || fiscalYearStart < 2000 || fiscalYearStart > 2100) {
      throw new ApiError(400, "Fiscal year must start between 2000 and 2100");
    }
    const [revenue, resources, costs] = await Promise.all([
      RevenueForecast.findOne({ fiscalYearStart }).lean(),
      ResourcePlan.findOne({ fiscalYearStart }).lean(),
      CostPlan.findOne({ fiscalYearStart }).lean(),
    ]);
    const dates = [revenue?.updatedAt, resources?.updatedAt, costs?.updatedAt]
      .filter((date): date is Date => Boolean(date));
    const updatedAt = dates.length
      ? dates.reduce((latest, date) => date > latest ? date : latest)
      : null;
    return res.status(200).json({
      success: true,
      data: buildInvestorFinancialPlan({
        fiscalYearStart,
        revenueStreams: revenue?.streams ?? [],
        resources: resources?.resources ?? [],
        costCategories: costs?.categories ?? [],
        updatedAt,
      }),
    });
  } catch (error) {
    next(error);
  }
}
