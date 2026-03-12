"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardCustomers } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const getSegmentColor = (segment: string): string => {
  switch (segment) {
    case "HIGH_VALUE":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    case "LOW_VALUE":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const CustomerInsights = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "customers"],
    queryFn: fetchDashboardCustomers,
  });

  return (
    <Card className="border-[#ecdccf] bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">Customer Insights</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading && (
          <div className="h-24 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load customers.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            {/* Summary counters */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Total Registered Customers",
                  value: data.totalRegisteredCustomers,
                },
                { label: "Top customers", value: data.topCustomers.length },
                { label: "Pending payments", value: data.pendingPayments },
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

            {/* CLV Summary Badges */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
                <p className="text-xs uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
                  High Value
                </p>
                <p className="mt-2 text-2xl font-bold text-green-900 dark:text-green-100">
                  {data.clvAnalytics.highValueCount}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-700 dark:text-gray-400">
                  Low Value
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.clvAnalytics.lowValueCount}
                </p>
              </div>
            </div>

            {/* Top Customers by Lifetime Value - with full details */}
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Top 5 customers by total purchase amount
              </p>
              {data.topCustomers.length === 0 ? (
                <p className="mt-3 text-sm text-[#8a6d56]">
                  No customer data available yet.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {data.topCustomers.map((customer) => {
                    // Find CLV data for this customer
                    let clvData: any = null;
                    let segment: "HIGH_VALUE" | "LOW_VALUE" = "LOW_VALUE";

                    const highValue = data.clvAnalytics.highValueCustomers.find(
                      (c) => c.customerName === customer.name
                    );
                    const lowValue = data.clvAnalytics.lowValueCustomers.find(
                      (c) => c.customerName === customer.name
                    );

                    if (highValue) {
                      segment = "HIGH_VALUE";
                      clvData = highValue;
                    } else if (lowValue) {
                      segment = "LOW_VALUE";
                      clvData = lowValue;
                    }

                    return (
                      <div
                        key={customer.name}
                        className="flex items-start justify-between rounded-xl border border-[#f2e6dc] bg-white px-4 py-3 text-sm"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#1f1b16]">
                              {customer.name}
                            </p>
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded-full ${getSegmentColor(
                                segment,
                              )}`}
                            >
                              {segment === "HIGH_VALUE"
                                ? "High Value"
                                : "Low Value"}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#8a6d56]">
                            <p>
                              Lifetime Value:{" "}
                              <span className="font-semibold text-[#1f1b16]">
                                {clvData
                                  ? formatCurrency(clvData.lifetimeValue)
                                  : formatCurrency(customer.totalPurchaseAmount)}
                              </span>
                            </p>
                            <p>
                              Predicted (6mo):{" "}
                              <span className="font-semibold text-[#1f1b16]">
                                {clvData
                                  ? formatCurrency(clvData.predicatedFutureValue)
                                  : "N/A"}
                              </span>
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-[#8a6d56]">
                            Orders: {customer.numberOfOrders}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daily / Weekly / Monthly customers */}
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Daily / Weekly / Monthly customers
              </p>
              <div className="mt-3 grid gap-2">
                {[
                  { label: "Daily", value: data.customerVisits.daily },
                  { label: "Weekly", value: data.customerVisits.weekly },
                  { label: "Monthly", value: data.customerVisits.monthly },
                ].map((period) => (
                  <div
                    key={period.label}
                    className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-[#1f1b16]">
                      {period.label}
                    </p>
                    <p className="text-xs text-[#8a6d56]">
                      Registered: {period.value.registeredCustomers} | Walk-in:{" "}
                      {period.value.walkInCustomers} | Total:{" "}
                      {period.value.totalCustomers}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerInsights;
