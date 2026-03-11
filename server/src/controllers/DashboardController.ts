import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { InvoiceStatus } from "@prisma/client";
import {
  buildMonthlyProfitSeries,
  buildNotifications,
  buildSalesForecast,
  getDailyExpenses,
  getExpenseTotals,
  getMonthlyExpenses,
} from "../services/dashboardAnalyticsService.js";

const toNumber = (value: unknown) => Number(value ?? 0);

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const toMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const toMonthLabel = (date: Date) =>
  date.toLocaleString("en-US", { month: "short", year: "numeric" });

const startOfDayUtc = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const buildDateSeries = (start: Date, days: number) => {
  const series: string[] = [];
  for (let i = 0; i < days; i += 1) {
    series.push(toDateKey(addDays(start, i)));
  }
  return series;
};

const dayOfWeekKey = (date: Date) => date.getUTCDay();

const percentChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
};

type CashInflowMode = "sales" | "payments" | "hybrid";

const resolveCashInflowMode = (value: unknown): CashInflowMode => {
  if (typeof value !== "string") return "sales";
  const normalized = value.trim().toLowerCase();
  if (normalized === "payments") return "payments";
  if (normalized === "hybrid") return "hybrid";
  return "sales";
};

class DashboardController {
  static async overview(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const todayStart = startOfDayUtc(now);
    const tomorrowStart = addDays(todayStart, 1);
    const yesterdayStart = addDays(todayStart, -1);
    const weekStart = startOfDayUtc(addDays(now, -6));
    const previousWeekStart = addDays(weekStart, -7);
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const previousMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );

    const [
      saleTotals,
      purchaseTotals,
      pendingSalesTotals,
      products,
      invoiceCounts,
      overdueInvoices,
      recentSales,
      recentPurchases,
      dailySales,
      dailyPurchases,
      previousDaySales,
      previousDayPurchases,
      weeklySales,
      weeklyPurchases,
      previousWeeklySales,
      previousWeeklyPurchases,
      monthlySales,
      monthlyPurchases,
      previousMonthlySales,
      previousMonthlyPurchases,
      pendingSalesRows,
      pendingPurchaseRows,
      dailyExpenses,
      previousDailyExpenses,
      weeklyExpenses,
      previousWeeklyExpenses,
      monthlyExpenses,
      previousMonthlyExpenses,
      totalExpenses,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { user_id: userId },
        _sum: { total: true },
      }),
      prisma.purchase.aggregate({
        where: { user_id: userId },
        _sum: { total: true, pendingAmount: true },
      }),
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
        },
        _sum: { pendingAmount: true },
      }),
      prisma.product.findMany({
        where: { user_id: userId },
        select: {
          name: true,
          stock_on_hand: true,
          reorder_level: true,
          price: true,
          cost: true,
        },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        where: { user_id: userId },
        _count: { id: true },
      }),
      prisma.invoice.findMany({
        where: { user_id: userId, status: InvoiceStatus.OVERDUE },
        select: { invoice_number: true },
        take: 5,
        orderBy: { date: "desc" },
      }),
      prisma.sale.findMany({
        where: { user_id: userId },
        select: { id: true, sale_date: true },
        orderBy: { sale_date: "desc" },
        take: 4,
      }),
      prisma.purchase.findMany({
        where: { user_id: userId },
        select: { id: true, purchase_date: true },
        orderBy: { purchase_date: "desc" },
        take: 4,
      }),
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          sale_date: { gte: todayStart, lt: tomorrowStart },
        },
        _sum: { total: true },
      }),
      prisma.purchase.aggregate({
        where: {
          user_id: userId,
          purchase_date: { gte: todayStart, lt: tomorrowStart },
        },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          sale_date: { gte: yesterdayStart, lt: todayStart },
        },
        _sum: { total: true },
      }),
      prisma.purchase.aggregate({
        where: {
          user_id: userId,
          purchase_date: { gte: yesterdayStart, lt: todayStart },
        },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { user_id: userId, sale_date: { gte: weekStart } },
        _sum: { total: true },
      }),
      prisma.purchase.aggregate({
        where: { user_id: userId, purchase_date: { gte: weekStart } },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          sale_date: { gte: previousWeekStart, lt: weekStart },
        },
        _sum: { total: true },
      }),
      prisma.purchase.aggregate({
        where: {
          user_id: userId,
          purchase_date: { gte: previousWeekStart, lt: weekStart },
        },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { user_id: userId, sale_date: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.purchase.aggregate({
        where: { user_id: userId, purchase_date: { gte: monthStart } },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          sale_date: { gte: previousMonthStart, lt: monthStart },
        },
        _sum: { total: true },
      }),
      prisma.purchase.aggregate({
        where: {
          user_id: userId,
          purchase_date: { gte: previousMonthStart, lt: monthStart },
        },
        _sum: { total: true },
      }),
      prisma.sale.findMany({
        where: {
          user_id: userId,
          paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
        },
        select: {
          id: true,
          sale_date: true,
          totalAmount: true,
          paidAmount: true,
          pendingAmount: true,
          paymentStatus: true,
          customer: { select: { name: true } },
        },
        orderBy: [{ sale_date: "desc" }],
        take: 8,
      }),
      prisma.purchase.findMany({
        where: {
          user_id: userId,
          pendingAmount: { gt: 0 },
        },
        select: {
          id: true,
          supplier: { select: { name: true } },
          pendingAmount: true,
        },
        take: 8,
      }),
      getExpenseTotals({ userId, from: todayStart, to: tomorrowStart }),
      getExpenseTotals({ userId, from: yesterdayStart, to: todayStart }),
      getExpenseTotals({ userId, from: weekStart }),
      getExpenseTotals({ userId, from: previousWeekStart, to: weekStart }),
      getExpenseTotals({ userId, from: monthStart }),
      getExpenseTotals({ userId, from: previousMonthStart, to: monthStart }),
      getExpenseTotals({ userId }),
    ]);

    const totalRevenue = toNumber(saleTotals._sum.total);
    const totalPurchases = toNumber(purchaseTotals._sum.total);
    const payables = toNumber(purchaseTotals._sum.pendingAmount);
    const expenses = totalExpenses;

    const toProfit = (
      salesValue: number,
      purchasesValue: number,
      expenseValue: number,
    ) => salesValue - purchasesValue - expenseValue;

    const todayProfit = toProfit(
      toNumber(dailySales._sum.total),
      toNumber(dailyPurchases._sum.total),
      dailyExpenses,
    );
    const previousDayProfit = toProfit(
      toNumber(previousDaySales._sum.total),
      toNumber(previousDayPurchases._sum.total),
      previousDailyExpenses,
    );
    const weeklyProfit = toProfit(
      toNumber(weeklySales._sum.total),
      toNumber(weeklyPurchases._sum.total),
      weeklyExpenses,
    );
    const previousWeeklyProfit = toProfit(
      toNumber(previousWeeklySales._sum.total),
      toNumber(previousWeeklyPurchases._sum.total),
      previousWeeklyExpenses,
    );
    const monthlyProfit = toProfit(
      toNumber(monthlySales._sum.total),
      toNumber(monthlyPurchases._sum.total),
      monthlyExpenses,
    );
    const previousMonthlyProfit = toProfit(
      toNumber(previousMonthlySales._sum.total),
      toNumber(previousMonthlyPurchases._sum.total),
      previousMonthlyExpenses,
    );

    const pendingPayments = toNumber(pendingSalesTotals._sum.pendingAmount);

    const pendingPaymentRows = pendingSalesRows
      .map((sale) => ({
        id: sale.id,
        invoiceNumber: `SI-${sale.id}`,
        customer: sale.customer?.name ?? "Walk-in",
        date: sale.sale_date,
        totalAmount: toNumber(sale.totalAmount),
        paidAmount: toNumber(sale.paidAmount),
        pendingAmount: toNumber(sale.pendingAmount),
        paymentStatus:
          sale.paymentStatus === "PARTIALLY_PAID" ? "PARTIAL" : "PENDING",
      }))
      .filter((sale) => sale.pendingAmount > 0);

    const inventoryValue = products.reduce((sum, product) => {
      const unit = toNumber(product.cost ?? product.price);
      return sum + unit * product.stock_on_hand;
    }, 0);

    const lowStockProducts = products.filter(
      (product) => product.stock_on_hand < product.reorder_level,
    );

    const invoiceStats = invoiceCounts.reduce(
      (acc, item) => {
        acc.total += item._count.id;
        if (item.status === InvoiceStatus.PAID) {
          acc.paid += item._count.id;
        } else if (
          item.status === InvoiceStatus.SENT ||
          item.status === InvoiceStatus.PARTIALLY_PAID
        ) {
          acc.pending += item._count.id;
        } else if (item.status === InvoiceStatus.OVERDUE) {
          acc.overdue += item._count.id;
        }
        return acc;
      },
      { total: 0, paid: 0, pending: 0, overdue: 0 },
    );

    const activity = [
      ...recentSales.map((sale) => ({
        time: sale.sale_date,
        label: `Sale #${sale.id} recorded`,
      })),
      ...recentPurchases.map((purchase) => ({
        time: purchase.purchase_date,
        label: `Purchase #${purchase.id} added`,
      })),
    ]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 6)
      .map((item) => ({
        time: item.time.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        label: item.label,
      }));

    return sendResponse(res, 200, {
      data: {
        metrics: {
          totalRevenue,
          totalSales: totalRevenue,
          totalPurchases,
          expenses,
          receivables: pendingPayments,
          payables,
          pendingPayments,
          inventoryValue,
          profits: {
            today: todayProfit,
            weekly: weeklyProfit,
            monthly: monthlyProfit,
          },
          changes: {
            totalRevenue: percentChange(totalRevenue, 0),
            totalSales: percentChange(totalRevenue, 0),
            totalPurchases: percentChange(totalPurchases, 0),
            receivables: percentChange(pendingPayments, 0),
            payables: percentChange(payables, 0),
            expenses: percentChange(expenses, 0),
            todayProfit: percentChange(todayProfit, previousDayProfit),
            weeklyProfit: percentChange(weeklyProfit, previousWeeklyProfit),
            monthlyProfit: percentChange(monthlyProfit, previousMonthlyProfit),
            pendingPayments: percentChange(pendingPayments, 0),
            inventoryValue: 0,
          },
        },
        pendingPayments: pendingPaymentRows.slice(0, 5).map((item) => ({
          id: item.id,
          invoiceNumber: item.invoiceNumber,
          customer: item.customer,
          totalAmount: item.totalAmount,
          paidAmount: item.paidAmount,
          pendingAmount: item.pendingAmount,
          paymentStatus: item.paymentStatus,
          date: item.date.toISOString(),
        })),
        invoiceStats,
        alerts: {
          lowStock: lowStockProducts
            .slice(0, 6)
            .map((item) => `${item.name} (${item.stock_on_hand})`),
          overdueInvoices: overdueInvoices.map((item) => item.invoice_number),
          supplierPayables: pendingPurchaseRows
            .slice(0, 5)
            .map(
              (item) =>
                `${item.supplier?.name ?? "Supplier"}: ₹${toNumber(item.pendingAmount).toLocaleString("en-IN")}`,
            ),
        },
        notifications: buildNotifications({
          lowStock: lowStockProducts
            .slice(0, 6)
            .map((item) => `${item.name} stock is ${item.stock_on_hand}`),
          overdueInvoices: overdueInvoices.map((item) => item.invoice_number),
          pendingSales: pendingPaymentRows.map((row) => ({
            customer: row.customer,
            pendingAmount: row.pendingAmount,
          })),
          supplierPayables: pendingPurchaseRows.map((row) => ({
            supplier: row.supplier?.name ?? "Supplier",
            pendingAmount: toNumber(row.pendingAmount),
          })),
        }),
        activity,
      },
    });
  }

  static async sales(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const start30 = startOfDayUtc(addDays(now, -29));
    const start7 = startOfDayUtc(addDays(now, -6));
    const start6Months = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    );

    const [sales, purchases, saleItems] = await Promise.all([
      prisma.sale.findMany({
        where: { user_id: userId, sale_date: { gte: start30 } },
        select: { sale_date: true, total: true },
      }),
      prisma.purchase.findMany({
        where: { user_id: userId, purchase_date: { gte: start6Months } },
        select: { purchase_date: true, total: true },
      }),
      prisma.saleItem.findMany({
        where: { sale: { user_id: userId, sale_date: { gte: start30 } } },
        select: {
          line_total: true,
          product: { select: { category: { select: { name: true } } } },
        },
      }),
    ]);

    const dailyTotals = new Map<string, number>();
    sales.forEach((sale) => {
      const key = toDateKey(sale.sale_date);
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + toNumber(sale.total));
    });

    const last30Days = buildDateSeries(start30, 30).map((key) => ({
      date: key,
      sales: dailyTotals.get(key) ?? 0,
    }));

    const last7Days = buildDateSeries(start7, 7).map((key) => ({
      date: key,
      sales: dailyTotals.get(key) ?? 0,
    }));

    const monthlyMap = new Map<
      string,
      { sales: number; purchases: number; labelDate: Date }
    >();
    for (let i = 0; i < 6; i += 1) {
      const date = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1),
      );
      monthlyMap.set(toMonthKey(date), {
        sales: 0,
        purchases: 0,
        labelDate: date,
      });
    }

    sales.forEach((sale) => {
      const key = toMonthKey(sale.sale_date);
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.sales += toNumber(sale.total);
      }
    });

    purchases.forEach((purchase) => {
      const key = toMonthKey(purchase.purchase_date);
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.purchases += toNumber(purchase.total);
      }
    });

    const monthly = Array.from(monthlyMap.values()).map((entry) => ({
      month: toMonthLabel(entry.labelDate),
      sales: entry.sales,
      purchases: entry.purchases,
    }));

    const categoryMap = new Map<string, number>();
    saleItems.forEach((item) => {
      const name = item.product?.category?.name ?? "Uncategorized";
      categoryMap.set(
        name,
        (categoryMap.get(name) ?? 0) + toNumber(item.line_total),
      );
    });

    const categories = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return sendResponse(res, 200, {
      data: {
        last7Days,
        last30Days,
        monthly,
        categories,
      },
    });
  }

  static async inventory(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const start30 = startOfDayUtc(addDays(now, -29));

    const [totalProducts, products, saleItems] = await Promise.all([
      prisma.product.count({ where: { user_id: userId } }),
      prisma.product.findMany({
        where: { user_id: userId },
        select: {
          name: true,
          stock_on_hand: true,
          reorder_level: true,
          cost: true,
          price: true,
        },
      }),
      prisma.saleItem.findMany({
        where: { sale: { user_id: userId, sale_date: { gte: start30 } } },
        select: { quantity: true, name: true },
      }),
    ]);

    const inventoryValue = products.reduce((sum, product) => {
      const unit = toNumber(product.cost ?? product.price);
      return sum + unit * product.stock_on_hand;
    }, 0);

    const lowStockProducts = products.filter(
      (product) => product.stock_on_hand < product.reorder_level,
    );
    const outOfStock = products.filter(
      (product) => product.stock_on_hand === 0,
    ).length;
    const lowStock = lowStockProducts.length;

    const salesMap = new Map<string, number>();
    saleItems.forEach((item) => {
      salesMap.set(item.name, (salesMap.get(item.name) ?? 0) + item.quantity);
    });

    const topSellingEntry = Array.from(salesMap.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    return sendResponse(res, 200, {
      data: {
        totalProducts,
        lowStock,
        outOfStock,
        inventoryValue,
        topSelling: topSellingEntry
          ? { name: topSellingEntry[0], units: topSellingEntry[1] }
          : null,
        lowStockItems: lowStockProducts
          .sort((a, b) => a.stock_on_hand - b.stock_on_hand)
          .slice(0, 6)
          .map((item) => ({
            name: item.name,
            stock: item.stock_on_hand,
            reorder: item.reorder_level,
          })),
      },
    });
  }

  static async transactions(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const sales = await prisma.sale.findMany({
      where: { user_id: userId },
      include: { customer: true },
      orderBy: { sale_date: "desc" },
      take: 10,
    });

    const transactions = sales.map((sale) => ({
      date: sale.sale_date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      invoiceNumber: `SI-${sale.id}`,
      customer: sale.customer?.name ?? "Walk-in",
      amount: toNumber(sale.totalAmount),
      paymentStatus:
        sale.paymentStatus === "PAID"
          ? "PAID"
          : sale.paymentStatus === "PARTIALLY_PAID"
            ? "PARTIAL"
            : "PENDING",
    }));

    return sendResponse(res, 200, { data: { transactions } });
  }

  static async customers(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const dayStart = startOfDayUtc(now);
    const weekStart = startOfDayUtc(addDays(now, -6));
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [
      totalRegisteredCustomers,
      pendingPaymentAgg,
      topCustomerSales,
      dailyRegisteredGroups,
      dailyWalkIns,
      weeklyRegisteredGroups,
      weeklyWalkIns,
      monthlyRegisteredGroups,
      monthlyWalkIns,
    ] = await Promise.all([
      prisma.customer.count({ where: { user_id: userId } }),
      prisma.sale.aggregate({
        where: {
          user_id: userId,
          paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
        },
        _sum: { pendingAmount: true },
      }),
      prisma.sale.groupBy({
        by: ["customer_id"],
        where: { user_id: userId, customer_id: { not: null } },
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      }),
      prisma.sale.groupBy({
        by: ["customer_id"],
        where: {
          user_id: userId,
          customer_id: { not: null },
          sale_date: { gte: dayStart },
        },
        _count: { _all: true },
      }),
      prisma.sale.count({
        where: {
          user_id: userId,
          customer_id: null,
          sale_date: { gte: dayStart },
        },
      }),
      prisma.sale.groupBy({
        by: ["customer_id"],
        where: {
          user_id: userId,
          customer_id: { not: null },
          sale_date: { gte: weekStart },
        },
        _count: { _all: true },
      }),
      prisma.sale.count({
        where: {
          user_id: userId,
          customer_id: null,
          sale_date: { gte: weekStart },
        },
      }),
      prisma.sale.groupBy({
        by: ["customer_id"],
        where: {
          user_id: userId,
          customer_id: { not: null },
          sale_date: { gte: monthStart },
        },
        _count: { _all: true },
      }),
      prisma.sale.count({
        where: {
          user_id: userId,
          customer_id: null,
          sale_date: { gte: monthStart },
        },
      }),
    ]);

    const customers = await prisma.customer.findMany({
      where: {
        id: {
          in: topCustomerSales
            .map((item) => item.customer_id)
            .filter((id): id is number => id !== null),
        },
      },
      select: { id: true, name: true },
    });

    const customerMap = new Map(
      customers.map((customer) => [customer.id, customer.name]),
    );

    const topCustomers = topCustomerSales
      .filter(
        (item): item is typeof item & { customer_id: number } =>
          item.customer_id !== null,
      )
      .map((item) => ({
        name: customerMap.get(item.customer_id) ?? "Customer",
        totalPurchaseAmount: toNumber(item._sum.total),
        numberOfOrders: item._count._all,
      }));

    const toVisitBreakdown = (
      registeredCustomers: number,
      walkInCustomers: number,
    ) => ({
      registeredCustomers,
      walkInCustomers,
      totalCustomers: registeredCustomers + walkInCustomers,
    });

    return sendResponse(res, 200, {
      data: {
        totalRegisteredCustomers,
        pendingPayments: toNumber(pendingPaymentAgg._sum.pendingAmount),
        customerVisits: {
          daily: toVisitBreakdown(dailyRegisteredGroups.length, dailyWalkIns),
          weekly: toVisitBreakdown(
            weeklyRegisteredGroups.length,
            weeklyWalkIns,
          ),
          monthly: toVisitBreakdown(
            monthlyRegisteredGroups.length,
            monthlyWalkIns,
          ),
        },
        topCustomers,
      },
    });
  }

  static async suppliers(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const start30 = startOfDayUtc(addDays(now, -29));

    const [total, recentPurchases, purchaseTotals] = await Promise.all([
      prisma.supplier.count({ where: { user_id: userId } }),
      prisma.purchase.count({
        where: { user_id: userId, purchase_date: { gte: start30 } },
      }),
      prisma.purchase.aggregate({
        where: { user_id: userId, purchase_date: { gte: start30 } },
        _sum: { pendingAmount: true },
      }),
    ]);

    return sendResponse(res, 200, {
      data: {
        total,
        recentPurchases,
        outstandingPayables: toNumber(purchaseTotals._sum.pendingAmount),
      },
    });
  }

  static async cashflow(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const start30 = startOfDayUtc(addDays(now, -29));
    const inflowMode = resolveCashInflowMode(
      req.query.inflowMode ?? process.env.DASHBOARD_CASHFLOW_INFLOW_MODE,
    );

    const [salesCollections, invoicePayments, purchases, dailyExpenses] =
      await Promise.all([
        prisma.sale.findMany({
          where: {
            user_id: userId,
            paidAmount: { gt: 0 },
            OR: [
              { paymentDate: { gte: start30 } },
              { paymentDate: null, sale_date: { gte: start30 } },
            ],
          },
          select: { sale_date: true, paymentDate: true, paidAmount: true },
        }),
        prisma.payment.findMany({
          where: { user_id: userId, paid_at: { gte: start30 } },
          select: { paid_at: true, amount: true },
        }),
        prisma.purchase.findMany({
          where: { user_id: userId, purchase_date: { gte: start30 } },
          select: { purchase_date: true, paymentDate: true, paidAmount: true },
        }),
        getDailyExpenses({ userId, from: start30 }),
      ]);

    const inflowMap = new Map<string, number>();

    if (inflowMode === "sales" || inflowMode === "hybrid") {
      salesCollections.forEach((sale) => {
        const key = toDateKey(sale.paymentDate ?? sale.sale_date);
        inflowMap.set(
          key,
          (inflowMap.get(key) ?? 0) + toNumber(sale.paidAmount),
        );
      });
    }

    if (inflowMode === "payments" || inflowMode === "hybrid") {
      invoicePayments.forEach((payment) => {
        const key = toDateKey(payment.paid_at);
        inflowMap.set(
          key,
          (inflowMap.get(key) ?? 0) + toNumber(payment.amount),
        );
      });
    }

    const outflowMap = new Map<string, number>();
    purchases.forEach((purchase) => {
      const key = toDateKey(purchase.paymentDate ?? purchase.purchase_date);
      outflowMap.set(
        key,
        (outflowMap.get(key) ?? 0) + toNumber(purchase.paidAmount),
      );
    });

    dailyExpenses.forEach((expense) => {
      const key = toDateKey(expense.day);
      outflowMap.set(key, (outflowMap.get(key) ?? 0) + expense.amount);
    });

    const series = buildDateSeries(start30, 30).map((key) => ({
      date: key,
      inflow: inflowMap.get(key) ?? 0,
      outflow: outflowMap.get(key) ?? 0,
    }));

    const inflow = series.reduce((sum, item) => sum + item.inflow, 0);
    const outflow = series.reduce((sum, item) => sum + item.outflow, 0);

    return sendResponse(res, 200, {
      data: {
        inflowSourceMode: inflowMode,
        inflow,
        outflow,
        netCashFlow: inflow - outflow,
        series,
      },
    });
  }

  static async forecast(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const start30 = startOfDayUtc(addDays(now, -29));
    const start6Months = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    );

    const [
      salesLast30,
      purchasesLast30,
      salesMonthlyRaw,
      purchasesMonthlyRaw,
      expenseMonthly,
    ] = await Promise.all([
      prisma.sale.findMany({
        where: { user_id: userId, sale_date: { gte: start30 } },
        select: { sale_date: true, total: true },
      }),
      prisma.purchase.findMany({
        where: { user_id: userId, purchase_date: { gte: start30 } },
        select: { purchase_date: true, total: true },
      }),
      prisma.sale.findMany({
        where: { user_id: userId, sale_date: { gte: start6Months } },
        select: { sale_date: true, total: true },
      }),
      prisma.purchase.findMany({
        where: { user_id: userId, purchase_date: { gte: start6Months } },
        select: { purchase_date: true, total: true },
      }),
      getMonthlyExpenses({ userId, from: start6Months }),
    ]);

    const salesByDate = new Map<string, number>();
    salesLast30.forEach((sale) => {
      const key = toDateKey(sale.sale_date);
      salesByDate.set(key, (salesByDate.get(key) ?? 0) + toNumber(sale.total));
    });

    const purchasesByDate = new Map<string, number>();
    purchasesLast30.forEach((purchase) => {
      const key = toDateKey(purchase.purchase_date);
      purchasesByDate.set(
        key,
        (purchasesByDate.get(key) ?? 0) + toNumber(purchase.total),
      );
    });

    const dailyExpenseByDate = new Map<string, number>();
    const dailyExpenseRows = await getDailyExpenses({ userId, from: start30 });
    dailyExpenseRows.forEach((row) => {
      const key = toDateKey(row.day);
      dailyExpenseByDate.set(
        key,
        (dailyExpenseByDate.get(key) ?? 0) + row.amount,
      );
    });

    const last30 = buildDateSeries(start30, 30).map((key) => {
      const revenue = salesByDate.get(key) ?? 0;
      const purchaseCost = purchasesByDate.get(key) ?? 0;
      const expenses = dailyExpenseByDate.get(key) ?? 0;
      const totalCost = purchaseCost + expenses;
      return {
        date: key,
        revenue,
        cost: totalCost,
        expenses,
        profit: revenue - totalCost,
      };
    });

    const monthlyProfitSeries = buildMonthlyProfitSeries({
      months: 6,
      sales: salesMonthlyRaw.map((item) => ({
        date: item.sale_date,
        total: item.total,
      })),
      purchases: purchasesMonthlyRaw.map((item) => ({
        date: item.purchase_date,
        total: item.total,
      })),
      expenses: expenseMonthly,
      fromDate: now,
    });

    const monthly = monthlyProfitSeries.map((entry) => ({
      month: entry.month,
      revenue: entry.revenue,
      totalCost: entry.totalCost,
      expenses: entry.expenses,
      profit: entry.profit,
      margin: entry.revenue === 0 ? 0 : (entry.profit / entry.revenue) * 100,
    }));

    const forecast = buildSalesForecast(
      monthlyProfitSeries.map((entry) => ({
        month: entry.month,
        value: entry.revenue,
      })),
    );

    return sendResponse(res, 200, {
      data: {
        profit: { monthly, last30 },
        forecast: {
          method: "moving-average-3m",
          historicalMonthly: monthlyProfitSeries.map((entry) => ({
            month: entry.month,
            sales: entry.revenue,
          })),
          predictedMonthly: forecast,
        },
      },
    });
  }
}

export default DashboardController;
