"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth, startOfQuarter, subMonths } from "date-fns";
import { motion } from "framer-motion";
import { RefreshCcw, Upload } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStrip } from "@/components/finance/kpi-strip";
import { QuickLinks } from "@/components/finance/quick-links";
import { UpcomingPayments } from "@/components/finance/upcoming-payments";
import { CashoutChart } from "@/components/finance/cashout-chart";
import { PaymentBreakdown } from "@/components/finance/payment-breakdown";
import { VendorTable } from "@/components/finance/vendor-table";
import { AttentionRail } from "@/components/finance/attention-rail";
import { getFinanceSummary, listVendors } from "@/services/bills";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";

type Preset = "this_month" | "last_month" | "quarter" | "fy" | "all";

const PRESET_LABELS: Record<Preset, string> = {
  this_month: "This month",
  last_month: "Last month",
  quarter: "This quarter",
  fy: "This FY",
  all: "All time",
};

function presetRange(preset: Preset): { date_from?: string; date_to?: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "this_month":
      return { date_from: fmt(startOfMonth(today)), date_to: fmt(endOfMonth(today)) };
    case "last_month": {
      const lm = subMonths(today, 1);
      return { date_from: fmt(startOfMonth(lm)), date_to: fmt(endOfMonth(lm)) };
    }
    case "quarter":
      return { date_from: fmt(startOfQuarter(today)), date_to: fmt(today) };
    case "fy": {
      // Indian financial year: 1 April – 31 March
      const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      return { date_from: `${fyStartYear}-04-01`, date_to: fmt(today) };
    }
    case "all":
      return {};
  }
}

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export default function FinanceDashboardPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const allowed = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !allowed) router.replace("/");
  }, [role, allowed, router]);

  const [preset, setPreset] = useState<Preset>("fy");
  const [vendorId, setVendorId] = useState<string>("");

  const range = useMemo(() => presetRange(preset), [preset]);

  const summaryQuery = useQuery({
    queryKey: ["finance-summary", range, vendorId],
    queryFn: () => getFinanceSummary({ ...range, vendor_id: vendorId || undefined }),
    enabled: allowed,
  });

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: listVendors, enabled: allowed });

  if (!allowed) return null;

  const summary = summaryQuery.data;
  const isEmpty = summary && summary.totals.bill_count === 0 && summary.totals.awaiting_review === 0 && summary.vendors.length === 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Finance</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">
            Company-wise spend, dues, and settlements from every verified bill.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/60 p-0.5 bg-muted/30">
            {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`px-3 h-8 rounded-md text-sm transition-colors ${
                  preset === p
                    ? "bg-background text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by company"
            className={selectClass}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
          >
            <option value="">All companies</option>
            {(vendorsQuery.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-24 rounded-2xl" />
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : summaryQuery.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-sm text-destructive">Couldn&apos;t load the finance summary.</p>
            <Button variant="outline" onClick={() => summaryQuery.refetch()}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="py-16 text-center space-y-4">
            <h3 className="text-xl font-heading font-semibold text-foreground">No verified bills yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Upload supplier bills and verify the AI-extracted totals — the dashboard fills in from there:
              spend by company, dues, and monthly cash-out.
            </p>
            <Link href="/finance/bills/upload">
              <Button className="mt-2">
                <Upload className="h-4 w-4 mr-2" /> Upload a bill
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : summary ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <KpiStrip summary={summary} />

          <QuickLinks />

          <div className="grid lg:grid-cols-5 gap-6 items-stretch">
            <Card className="border-border/50 bg-card/80 lg:col-span-3">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Monthly billed vs paid</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <CashoutChart summary={summary} />
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/80 lg:col-span-2">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Payment status</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <PaymentBreakdown summary={summary} />
              </CardContent>
            </Card>
          </div>

          <div className="grid xl:grid-cols-3 gap-6 items-start">
            <div className="xl:col-span-2 space-y-6">
              <UpcomingPayments vendorId={vendorId || undefined} daysAhead={7} maxRows={4} />

              <Card className="border-border/50 bg-card/80">
                <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Top companies by outstanding</CardTitle>
                  <Link href="/finance/vendors" className="text-sm text-primary hover:underline underline-offset-4">
                    View all vendors →
                  </Link>
                </CardHeader>
                <CardContent className="p-0">
                  <VendorTable vendors={summary.vendors} limit={5} />
                </CardContent>
              </Card>
            </div>

            <AttentionRail summary={summary} />
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
