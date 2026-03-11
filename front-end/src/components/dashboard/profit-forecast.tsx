"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { fetchDashboardForecast } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const formatTooltipValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return formatTooltipValue(value[0]);
  }

  if (typeof value === "number") {
    return formatCurrency(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return formatCurrency(Number.isFinite(parsed) ? parsed : 0);
  }

  return formatCurrency(0);
};

const ProfitForecast = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "forecast"],
    queryFn: fetchDashboardForecast,
  });

  const monthlyProfit = data?.profit.monthly ?? [];
  const historical = data?.forecast.historicalMonthly ?? [];
  const predicted = data?.forecast.predictedMonthly ?? [];

  const totalRevenue = monthlyProfit.reduce(
    (sum, item) => sum + item.revenue,
    0,
  );
  const totalCost = monthlyProfit.reduce(
    (sum, item) => sum + item.totalCost,
    0,
  );
  const totalProfit = monthlyProfit.reduce((sum, item) => sum + item.profit, 0);
  const avgMargin = totalRevenue === 0 ? 0 : (totalProfit / totalRevenue) * 100;

  const forecastSeries = [
    ...historical.map((item) => ({ month: item.month, actual: item.sales })),
    ...predicted.map((item) => ({ month: item.month, forecast: item.value })),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="border-[#ecdccf] bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Profit analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {isLoading && (
            <div className="h-40 rounded-xl bg-[#fdf7f1] animate-pulse" />
          )}
          {isError && (
            <p className="text-sm text-[#b45309]">
              Unable to load profit data.
            </p>
          )}
          {!isLoading && !isError && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Total revenue",
                    value: formatCurrency(totalRevenue),
                  },
                  {
                    label: "Total cost",
                    value: formatCurrency(totalCost),
                  },
                  {
                    label: "Net profit",
                    value: formatCurrency(totalProfit),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                      {item.label}
                    </p>
                    <p className="mt-3 text-lg font-semibold text-[#1f1b16]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  Monthly profit trend
                </p>
                <div className="mt-3 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyProfit}>
                      <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(value)}
                      />
                      <Bar
                        dataKey="profit"
                        fill={totalProfit >= 0 ? "#16a34a" : "#dc2626"}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-[#8a6d56]">
                  Avg margin: {avgMargin.toFixed(1)}%
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#ecdccf] bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Sales forecasting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {isLoading && (
            <div className="h-40 rounded-xl bg-[#fdf7f1] animate-pulse" />
          )}
          {isError && (
            <p className="text-sm text-[#b45309]">Unable to load forecast.</p>
          )}
          {!isLoading && !isError && (
            <>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Method: {data?.forecast.method ?? "-"}
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastSeries}>
                    <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatTooltipValue(value)} />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#0f766e"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-[#8a6d56]">
                Forecast uses a 3-month moving average and fills missing months
                with zero values before prediction.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitForecast;
