"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { listVendorsFull } from "@/services/vendors";
import { getFinanceSummary } from "@/services/bills";
import { VendorFormDialog } from "@/components/finance/vendor-form";
import { formatINR } from "@/utils/currency";

export default function VendorsPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const vendorsQuery = useQuery({ queryKey: ["vendors-full"], queryFn: listVendorsFull, enabled: canReview });
  const summaryQuery = useQuery({ queryKey: ["finance-summary", {}, ""], queryFn: () => getFinanceSummary(), enabled: canReview });

  const outstandingByVendor = useMemo(() => {
    const map = new Map<string, number>();
    (summaryQuery.data?.vendors ?? []).forEach((v) => {
      if (v.vendor_id) map.set(v.vendor_id, v.outstanding);
    });
    return map;
  }, [summaryQuery.data]);

  if (!canReview) return null;

  const vendors = vendorsQuery.data ?? [];
  const isLoading = vendorsQuery.isLoading;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Vendors</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">
            Suppliers, their payment terms, bank details, and how much you owe each of them.
          </p>
        </div>
        <VendorFormDialog trigger={<Button><Plus className="mr-2 h-4 w-4" /> Add vendor</Button>} />
      </div>

      <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-md">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center px-6">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium text-foreground">No vendors yet</p>
              <p className="text-sm mt-1 max-w-sm">Vendors are created here or automatically when a bill names a new supplier.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[36rem]">
                <thead className="border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">GSTIN</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment terms</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {vendors.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/finance/vendors/${v.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                          {v.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{v.gstin || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {v.payment_terms_days != null ? `${v.payment_terms_days} days` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                        {outstandingByVendor.has(v.id) ? formatINR(outstandingByVendor.get(v.id)) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
