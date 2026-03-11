"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { fetchDashboardCashflow } from "@/lib/apiClient";
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

const CashFlowChart = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "cashflow"],
    queryFn: fetchDashboardCashflow,
  });

  const net = data?.netCashFlow ?? 0;
  const netClass =
    net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-amber-700";

  return (
    <Card className="border-[#ecdccf] bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">Cash flow summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6">
        {isLoading && (
          <div className="h-32 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load cash flow.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Cash inflow", value: formatCurrency(data.inflow) },
                { label: "Cash outflow", value: formatCurrency(data.outflow) },
                {
                  label: "Net cash flow",
                  value: formatCurrency(data.netCashFlow),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {item.label}
                  </p>
                  <p
                    className={`mt-3 text-lg font-semibold ${
                      item.label === "Net cash flow"
                        ? netClass
                        : "text-[#1f1b16]"
                    }`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series}>
                  <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatTooltipValue(value)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="inflow"
                    stroke="#0f766e"
                    fill="rgba(15,118,110,0.2)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="outflow"
                    stroke="#f97316"
                    fill="rgba(249,115,22,0.2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CashFlowChart;
