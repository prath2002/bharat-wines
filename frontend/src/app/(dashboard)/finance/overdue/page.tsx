"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { format } from "date-fns";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { OverdueBillItem } from "@/types/bill";
import { getOverdueBills } from "@/services/finance";
import { PaymentBadge } from "@/components/finance/badges";
import { formatINR } from "@/utils/currency";

function overdueClass(days: number): string {
  if (days > 60) return "text-rose-700 dark:text-rose-400 font-semibold";
  if (days > 30) return "text-amber-700 dark:text-amber-400 font-medium";
  return "text-foreground";
}

function OverdueTable({ items }: { items: OverdueBillItem[] }) {
  return (
    <table className="w-full text-sm min-w-[42rem]">
      <thead className="border-b border-border/50">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill</th>
          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due date</th>
          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Days overdue</th>
          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {items.map((b) => (
          <tr key={b.id} className="hover:bg-muted/40 transition-colors">
            <td className="px-4 py-3 text-foreground">{b.vendor_name || "—"}</td>
            <td className="px-4 py-3">
              <Link href={`/finance/bills/${b.id}`} className="text-primary hover:underline underline-offset-4">
                {b.bill_number || "Bill"}
              </Link>
            </td>
            <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{formatINR(b.outstanding)}</td>
            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(b.due_date), "d MMM yyyy")}</td>
            <td className={`px-4 py-3 text-right tabular-nums ${overdueClass(b.days_overdue)}`}>{b.days_overdue}d</td>
            <td className="px-4 py-3"><PaymentBadge status={b.payment_status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function OverdueBillsPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const [groupByVendor, setGroupByVendor] = useState(false);
  const overdueQuery = useQuery({ queryKey: ["overdue-bills-page"], queryFn: () => getOverdueBills(), enabled: canReview });

  const grouped = useMemo(() => {
    const items = overdueQuery.data ?? [];
    const map = new Map<string, { vendorName: string; items: OverdueBillItem[]; total: number }>();
    for (const item of items) {
      const key = item.vendor_id ?? "unknown";
      const g = map.get(key) ?? { vendorName: item.vendor_name || "Unknown vendor", items: [], total: 0 };
      g.items.push(item);
      g.total += item.outstanding;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [overdueQuery.data]);

  if (!canReview) return null;

  const items = overdueQuery.data ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Overdue Bills</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">Past their due date and still outstanding.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={groupByVendor} onChange={(e) => setGroupByVendor(e.target.checked)} className="rounded border-input" />
          Group by vendor
        </label>
      </div>

      <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-md">
        <CardContent className="p-0">
          {overdueQuery.isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">Nothing overdue right now.</div>
          ) : groupByVendor ? (
            <div className="divide-y divide-border/50">
              {grouped.map((g) => (
                <div key={g.vendorName}>
                  <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{g.vendorName}</span>
                    <span className="text-sm font-medium tabular-nums text-foreground">{formatINR(g.total)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <OverdueTable items={g.items} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <OverdueTable items={items} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
