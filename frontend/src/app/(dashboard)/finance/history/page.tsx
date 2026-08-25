"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { listVendors } from "@/services/bills";
import { getPaymentHistory } from "@/services/finance";
import { formatINR } from "@/utils/currency";

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: "Bank transfer", UPI: "UPI", CASH: "Cash", CHEQUE: "Cheque", OTHER: "Other",
};

export default function PaymentHistoryPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [vendorId, setVendorId] = useState("");

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: listVendors, enabled: canReview });
  const historyQuery = useQuery({
    queryKey: ["payment-history", dateFrom, dateTo, vendorId],
    queryFn: () => getPaymentHistory({ date_from: dateFrom || undefined, date_to: dateTo || undefined, vendor_id: vendorId || undefined }),
    enabled: canReview,
  });

  if (!canReview) return null;

  const items = historyQuery.data ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Payment History</h2>
        <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">Every completed payment, with reference and approver.</p>
      </div>

      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            From
            <input type="date" className={selectClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            To
            <input type="date" className={selectClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Vendor
            <select className={selectClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">All vendors</option>
              {(vendorsQuery.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-md">
        <CardContent className="p-0">
          {historyQuery.isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No completed payments in this range.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[42rem]">
                <thead className="border-b border-border/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paid on</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {items.map((p) => (
                    <tr key={p.settlement_id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 text-foreground">{p.vendor_name || "—"}</td>
                      <td className="px-4 py-3">
                        <Link href={`/finance/bills/${p.bill_id}`} className="text-primary hover:underline underline-offset-4">
                          {p.bill_number || "Bill"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{formatINR(p.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(p.paid_on), "d MMM yyyy")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{METHOD_LABELS[p.method] ?? p.method}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.reference || "—"}</td>
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
