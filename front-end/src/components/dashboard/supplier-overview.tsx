"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardSuppliers } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SupplierOverview = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "suppliers"],
    queryFn: fetchDashboardSuppliers,
  });

  return (
    <Card className="border-[#ecdccf] bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">Supplier overview</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading && (
          <div className="h-20 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load suppliers.</p>
        )}
        {!isLoading && !isError && data && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Total suppliers", value: data.total },
              { label: "Recent purchases", value: data.recentPurchases },
              {
                label: "Outstanding payables",
                value: data.outstandingPayables,
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
        )}
      </CardContent>
    </Card>
  );
};

export default SupplierOverview;
