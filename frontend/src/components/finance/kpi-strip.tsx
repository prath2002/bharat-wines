"use client";

import Link from "next/link";
import { FinanceSummary } from "@/types/bill";
import { AnimatedCounter } from "@/components/ui/animated-counter";

function KpiStat({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "default" | "urgent" | "warning";
}) {
  const toneClass =
    tone === "urgent"
      ? "text-rose-700 dark:text-rose-400"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-400"
        : "text-foreground";

  const content = (
    <div className="px-5 py-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${toneClass}`}>
        ₹<AnimatedCounter value={Math.round(value)} />
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="flex-1 min-w-[10rem] hover:bg-muted/40 transition-colors">
      {content}
    </Link>
  ) : (
    <div className="flex-1 min-w-[10rem]">{content}</div>
  );
}

/** The one headline strip on the finance dashboard — just the four numbers
 * that demand attention today. Everything else (paid/billed totals, monthly
 * trend, vendor breakdown) lives in the charts below or on a dedicated page. */
export function KpiStrip({ summary }: { summary: FinanceSummary }) {
  const t = summary.totals;
  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-md flex flex-wrap divide-x divide-border/50 overflow-hidden">
      <KpiStat label="Outstanding" value={t.outstanding} href="/finance/pending" tone={t.outstanding > 0 ? "urgent" : "default"} />
      <KpiStat label="Due today" value={t.due_today} href="/finance/pending" tone={t.due_today > 0 ? "urgent" : "default"} />
      <KpiStat label="Scheduled" value={t.scheduled_amount} href="/finance/schedules" tone={t.scheduled_count > 0 ? "warning" : "default"} />
      <Link href="/finance/bills?status=DRAFT" className="flex-1 min-w-[10rem] hover:bg-muted/40 transition-colors">
        <div className="px-5 py-4">
          <div className="text-sm text-muted-foreground">Awaiting review</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${t.awaiting_review > 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground"}`}>
            <AnimatedCounter value={t.awaiting_review} />
          </div>
        </div>
      </Link>
    </div>
  );
}
