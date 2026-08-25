"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowUpDown } from "lucide-react";

import { FinanceSummary } from "@/types/bill";
import { formatINR } from "@/utils/currency";

type VendorRow = FinanceSummary["vendors"][number];
type SortKey = "billed" | "paid" | "outstanding" | "oldest_unpaid_days";

function agingClass(days: number): string {
  if (days > 60) return "text-rose-700 dark:text-rose-400 font-medium";
  if (days > 30) return "text-amber-700 dark:text-amber-400 font-medium";
  return "text-muted-foreground";
}

export function VendorTable({ vendors, limit }: { vendors: VendorRow[]; limit?: number }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("outstanding");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const all = [...vendors].sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return limit ? all.slice(0, limit) : all;
  }, [vendors, sortKey, desc, limit]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setDesc(!desc);
    else {
      setSortKey(key);
      setDesc(true);
    }
  };

  if (vendors.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Companies appear here as bills are verified.
      </div>
    );
  }

  const header = (label: string, key?: SortKey, alignRight = true) => (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${alignRight ? "text-right" : "text-left"}`}>
      {key ? (
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${sortKey === key ? "text-foreground" : ""}`}
        >
          {label}
          <ArrowUpDown className="h-3 w-3" aria-hidden />
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[40rem]">
        <thead className="border-b border-border/50">
          <tr>
            {header("Company", undefined, false)}
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bills</th>
            {header("Billed", "billed")}
            {header("Paid", "paid")}
            {header("Outstanding", "outstanding")}
            {header("Oldest due", "oldest_unpaid_days")}
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last bill</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {sorted.map((v) => (
            <tr
              key={v.vendor_id ?? v.name}
              className={v.vendor_id ? "hover:bg-muted/40 cursor-pointer transition-colors" : ""}
              onClick={() => v.vendor_id && router.push(`/finance/bills?vendor_id=${v.vendor_id}`)}
            >
              <td className="px-4 py-3 font-medium text-foreground max-w-56 truncate">{v.name}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{v.bill_count}</td>
              <td className="px-4 py-3 text-right tabular-nums text-foreground">{formatINR(v.billed)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatINR(v.paid)}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${v.outstanding > 0 ? "text-rose-700 dark:text-rose-400 font-semibold" : "text-muted-foreground"}`}>
                {formatINR(v.outstanding)}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums ${agingClass(v.oldest_unpaid_days)}`}>
                {v.outstanding > 0 ? `${v.oldest_unpaid_days}d` : "—"}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                {v.last_bill_date ? format(new Date(v.last_bill_date), "d MMM yy") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
