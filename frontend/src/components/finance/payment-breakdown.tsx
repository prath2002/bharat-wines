"use client";

import { FinanceSummary, PaymentStatus } from "@/types/bill";
import { formatINR } from "@/utils/currency";
import { useChartColors } from "@/components/finance/chart-colors";

const LABELS: Record<PaymentStatus, string> = {
  PAID: "Paid",
  PARTIALLY_PAID: "Partially paid",
  UNPAID: "Unpaid",
};

const ORDER: PaymentStatus[] = ["PAID", "PARTIALLY_PAID", "UNPAID"];

/**
 * Slim horizontal stacked bar of bill value by payment state, with a
 * count+amount legend. Direct labels + gaps carry identity alongside color.
 */
export function PaymentBreakdown({ summary }: { summary: FinanceSummary }) {
  const colors = useChartColors();
  const rows = ORDER.map((status) => ({
    status,
    ...summary.payment_breakdown[status],
  }));
  const total = rows.reduce((acc, r) => acc + r.amount, 0);

  if (total === 0) {
    return (
      <div className="h-full min-h-40 flex items-center justify-center text-sm text-muted-foreground">
        Payment state appears once bills are verified.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img"
        aria-label={rows.map((r) => `${LABELS[r.status]}: ${formatINR(r.amount)} across ${r.count} bills`).join("; ")}>
        {rows.filter((r) => r.amount > 0).map((r) => (
          <div
            key={r.status}
            className="h-full border-r-2 border-card last:border-r-0"
            style={{ width: `${(r.amount / total) * 100}%`, backgroundColor: colors.status[r.status] }}
          />
        ))}
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.status} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: colors.status[r.status] }}
            />
            <span className="text-foreground font-medium w-32">{LABELS[r.status]}</span>
            <span className="text-muted-foreground">{r.count} bill{r.count === 1 ? "" : "s"}</span>
            <span className="ml-auto tabular-nums font-medium text-foreground">{formatINR(r.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
