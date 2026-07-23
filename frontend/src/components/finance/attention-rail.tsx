"use client";

import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Clock, FileWarning } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FinanceSummary } from "@/types/bill";
import { formatINR } from "@/utils/currency";

export function AttentionRail({ summary }: { summary: FinanceSummary }) {
  const { drafts, overdue } = summary.attention;

  if (drafts.length === 0 && overdue.length === 0) {
    return (
      <Card className="border-border/50 bg-card/80">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nothing needs attention. Drafts to review and overdue bills will surface here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {drafts.length > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <FileWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              To review ({drafts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border/40">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link href={`/finance/bills/${d.id}`} className="flex items-center gap-3 py-2.5 group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {d.extracted_vendor_name || "Unknown company"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(d.created_at), "d MMM, h:mm a")}
                      </div>
                    </div>
                    {d.has_total_mismatch && (
                      <span title="Totals don't add up">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      </span>
                    )}
                    <span className="text-sm tabular-nums text-muted-foreground">{formatINR(d.total_amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {overdue.length > 0 && (
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <Clock className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              Overdue ({overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border/40">
              {overdue.map((o) => (
                <li key={o.id}>
                  <Link href={`/finance/bills/${o.id}`} className="flex items-center gap-3 py-2.5 group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {o.vendor_name}
                      </div>
                      <div className="text-xs text-rose-700 dark:text-rose-400">
                        {o.days_overdue} days overdue · due {format(new Date(o.due_date), "d MMM")}
                      </div>
                    </div>
                    <span className="text-sm tabular-nums font-medium text-foreground">{formatINR(o.outstanding)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
