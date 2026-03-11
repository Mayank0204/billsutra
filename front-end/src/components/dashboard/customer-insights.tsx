"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardCustomers } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const CustomerInsights = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "customers"],
    queryFn: fetchDashboardCustomers,
  });

  return (
    <Card className="border-[#ecdccf] bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">Customer insights</CardTitle>
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
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Top 5 customers by total purchase amount
              </p>
              {data.topCustomers.length === 0 ? (
                <p className="mt-3 text-sm text-[#8a6d56]">
                  No customer revenue yet.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {data.topCustomers.map((customer) => (
                    <div
                      key={customer.name}
                      className="flex items-center justify-between rounded-xl border border-[#f2e6dc] bg-white px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-[#1f1b16]">
                          {customer.name}
                        </p>
                        <p className="text-xs text-[#8a6d56]">
                          Orders: {customer.numberOfOrders}
                        </p>
                      </div>
                      <span className="text-[#5c4b3b]">
                        {formatCurrency(customer.totalPurchaseAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
