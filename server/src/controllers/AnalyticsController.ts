import type { Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";

const toNumber = (value: unknown) => Number(value ?? 0);

const getMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const getMonthLabel = (date: Date) =>
  date.toLocaleString("en-US", { month: "short", year: "numeric" });

const getLast12Months = () => {
  const now = new Date();
  const months: { key: string; label: string; start: Date }[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    months.push({
      key: getMonthKey(start),
      label: getMonthLabel(start),
      start,
    });
  }

  return months;
};

class AnalyticsController {
  static async overview(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();

    // Keep invoice status accuracy up to date before aggregating analytics.
    await prisma.invoice.updateMany({
      where: {
        user_id: userId,
        due_date: { lt: now },
        status: { not: InvoiceStatus.PAID },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });

    const months = getLast12Months();
    const firstMonthStart =
      months[0]?.start ??
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      revenueAgg,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      paidInLast12Months,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          user_id: userId,
          status: InvoiceStatus.PAID,
        },
        _sum: { total: true },
      }),
      prisma.invoice.count({
        where: {
          user_id: userId,
          status: InvoiceStatus.PAID,
        },
      }),
      prisma.invoice.count({
        where: {
          user_id: userId,
          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.DRAFT,
            ],
          },
        },
      }),
      prisma.invoice.count({
        where: {
          user_id: userId,
          status: InvoiceStatus.OVERDUE,
        },
      }),
      prisma.invoice.findMany({
        where: {
          user_id: userId,
          status: InvoiceStatus.PAID,
          date: { gte: firstMonthStart },
        },
        select: {
          date: true,
          total: true,
        },
      }),
    ]);

    const monthlyMap = new Map<string, number>(
      months.map((month) => [month.key, 0]),
    );

    for (const invoice of paidInLast12Months) {
      const key = getMonthKey(invoice.date);
      if (monthlyMap.has(key)) {
        monthlyMap.set(
          key,
          (monthlyMap.get(key) ?? 0) + toNumber(invoice.total),
        );
      }
    }

    const monthlyRevenue = months.map((month) => ({
      month: month.label,
      revenue: monthlyMap.get(month.key) ?? 0,
    }));

    return sendResponse(res, 200, {
      data: {
        totalRevenue: toNumber(revenueAgg._sum.total),
        paidInvoices,
        pendingInvoices,
        overdueInvoices,
        monthlyRevenue,
      },
    });
  }
}

export default AnalyticsController;
