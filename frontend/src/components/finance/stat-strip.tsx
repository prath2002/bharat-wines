"use client";

import Link from "next/link";
import { FinanceSummary } from "@/types/bill";
import { AnimatedCounter } from "@/components/ui/animated-counter";

function Stat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  tone?: "default" | "negative" | "positive";
  hint?: string;
}) {
  const toneClass =
    tone === "negative"
      ? "text-rose-700 dark:text-rose-400"
      : tone === "positive"
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-foreground";

  return (
    <div className="flex-1 min-w-[10rem] px-5 py-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${toneClass}`}>
        ₹<AnimatedCounter value={Math.round(value)} />
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function StatStrip({ summary }: { summary: FinanceSummary }) {
  const t = summary.totals;
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md flex flex-wrap divide-x divide-border/50 overflow-hidden">
      <Stat label="Outstanding" value={t.outstanding} tone={t.outstanding > 0 ? "negative" : "positive"} hint="Across all verified bills" />
      <Stat label="Paid in period" value={t.paid} tone="positive" />
      <Stat label="Billed in period" value={t.billed} hint={`${t.bill_count} bill${t.bill_count === 1 ? "" : "s"} · ₹${Intl.NumberFormat("en-IN").format(Math.round(t.discounts))} discounts`} />
      <Link href="/finance/bills?status=DRAFT" className="flex-1 min-w-[10rem] hover:bg-muted/40 transition-colors">
        <div className="px-5 py-4">
          <div className="text-sm text-muted-foreground">Awaiting review</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${summary.totals.awaiting_review > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>
            <AnimatedCounter value={t.awaiting_review} />
          </div>
          <div className="mt-0.5 text-xs text-primary">Open drafts →</div>
        </div>
      </Link>
    </div>
  );
}
