"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Plus, Receipt, ChevronRight, FileSearch, AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { Bill, BillLimited, BillListFilters, BillStatus, PaymentStatus, Vendor } from "@/types/bill";
import { listBills, listVendors } from "@/services/bills";
import { formatINR } from "@/utils/currency";
import { BillStatusBadge, PaymentBadge } from "@/components/finance/badges";

const FINANCE_ROLES = [Role.ADMIN, Role.FINANCE];

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function FinanceFilters({
  filters,
  setFilters,
  vendors,
}: {
  filters: BillListFilters;
  setFilters: (f: BillListFilters) => void;
  vendors: Vendor[];
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Status
        <select
          className={selectClass}
          value={filters.status ?? ""}
          onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as BillStatus | undefined })}
        >
          <option value="">All</option>
          <option value="PROCESSING">Reading (AI)</option>
          <option value="DRAFT">Review required</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Payment
        <select
          className={selectClass}
          value={filters.payment_status ?? ""}
          onChange={(e) =>
            setFilters({ ...filters, payment_status: (e.target.value || undefined) as PaymentStatus | undefined })
          }
        >
          <option value="">All</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially paid</option>
          <option value="PAID">Paid</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Company
        <select
          className={selectClass}
          value={filters.vendor_id ?? ""}
          onChange={(e) => setFilters({ ...filters, vendor_id: e.target.value || undefined })}
        >
          <option value="">All companies</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        From
        <input
          type="date"
          className={selectClass}
          value={filters.date_from ?? ""}
          onChange={(e) => setFilters({ ...filters, date_from: e.target.value || undefined })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        To
        <input
          type="date"
          className={selectClass}
          value={filters.date_to ?? ""}
          onChange={(e) => setFilters({ ...filters, date_to: e.target.value || undefined })}
        />
      </label>
    </div>
  );
}

export default function BillsPage() {
  return (
    <Suspense fallback={null}>
      <BillsPageInner />
    </Suspense>
  );
}

function BillsPageInner() {
  const role = useAuthStore((state) => state.user?.role);
  const canViewFinancials = !!role && FINANCE_ROLES.includes(role);
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<BillListFilters>(() => ({
    status: (searchParams.get("status") as BillListFilters["status"]) ?? undefined,
    vendor_id: searchParams.get("vendor_id") ?? undefined,
  }));

  const billsQuery = useQuery({
    queryKey: ["bills", filters],
    queryFn: () => listBills(filters),
    refetchInterval: (query) =>
      query.state.data?.items.some((b) => b.status === "PROCESSING") ? 5000 : false,
  });

  const vendorsQuery = useQuery({
    queryKey: ["vendors"],
    queryFn: listVendors,
    enabled: canViewFinancials,
  });

  const items = billsQuery.data?.items ?? [];
  const apiBase = useMemo(
    () => (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/api\/v1$/, ""),
    []
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">
            {canViewFinancials ? "Purchase Bills" : "My Bill Uploads"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">
            {canViewFinancials
              ? "Every supplier bill, read by AI and segregated by company. Review drafts, then track payment."
              : "Photograph supplier bills as they arrive. The finance team takes it from there."}
          </p>
        </div>
        <Link href="/finance/bills/upload" className="w-full md:w-auto">
          <Button className="w-full md:w-auto shadow-[0_0_15px_var(--color-primary)] bg-gradient-to-r from-primary to-primary/80 hover:scale-105 active:scale-95 transition-all">
            <Plus className="mr-2 h-4 w-4" /> Upload Bill
          </Button>
        </Link>
      </div>

      {canViewFinancials && (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-4">
            <FinanceFilters filters={filters} setFilters={setFilters} vendors={vendorsQuery.data ?? []} />
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-md">
        <CardContent className="p-0">
          {billsQuery.isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-24 hidden md:block" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center px-6">
              <FileSearch className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="font-medium text-foreground">No bills yet</p>
              <p className="text-sm mt-1 max-w-sm">
                Photograph a purchase bill — AI reads the totals, discounts, and charges for you.
              </p>
              <Link href="/finance/bills/upload" className="mt-5">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" /> Upload your first bill
                </Button>
              </Link>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="divide-y divide-border/50"
            >
              {items.map((item) => {
                const bill = item as Bill;
                const limited = item as BillLimited;
                const href = canViewFinancials ? `/finance/bills/${item.id}` : undefined;

                const row = (
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-5 hover:bg-muted/40 transition-colors group gap-4">
                    <div className="flex gap-5 items-center w-full md:w-auto min-w-0">
                      <div className="h-14 w-14 shrink-0 rounded-xl bg-muted/60 border border-border/50 overflow-hidden flex items-center justify-center text-primary">
                        {/\.(jpe?g|png|webp)$/i.test(item.file_url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${apiBase}${item.file_url}`}
                            alt="Bill thumbnail"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Receipt className="h-6 w-6" />
                        )}
                      </div>
                      <div className="min-w-0">
                        {canViewFinancials ? (
                          <>
                            <h4 className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors truncate flex items-center gap-2">
                              {bill.vendor_name || bill.extracted_vendor_name || "Company pending"}
                              {!bill.vendor_id && bill.status !== "PROCESSING" && (
                                <Badge variant="outline" className="text-muted-foreground">unmatched</Badge>
                              )}
                              {bill.has_total_mismatch && (
                                <span title="Extracted total doesn't add up">
                                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                </span>
                              )}
                            </h4>
                            <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>{bill.bill_number || "No bill number"}</span>
                              <span>&bull;</span>
                              <span className="font-mono">
                                {bill.bill_date
                                  ? format(new Date(bill.bill_date), "d MMM yyyy")
                                  : format(new Date(bill.created_at), "d MMM yyyy")}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <h4 className="font-semibold text-foreground text-lg">
                              Bill uploaded {format(new Date(limited.created_at), "d MMM yyyy")}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {format(new Date(limited.created_at), "h:mm a")}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between w-full md:w-auto gap-6">
                      {canViewFinancials && (
                        <div className="text-left md:text-right">
                          <div className="text-lg font-semibold tabular-nums text-foreground">
                            {formatINR(bill.total_amount)}
                          </div>
                          {bill.status === "VERIFIED" && (
                            <div className="mt-1 flex md:justify-end">
                              <PaymentBadge status={bill.payment_status} />
                            </div>
                          )}
                        </div>
                      )}
                      <BillStatusBadge status={item.status} />
                      {canViewFinancials && (
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all hidden md:block" />
                      )}
                    </div>
                  </div>
                );

                return href ? (
                  <Link key={item.id} href={href} className="block">
                    {row}
                  </Link>
                ) : (
                  <div key={item.id}>{row}</div>
                );
              })}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {billsQuery.data && billsQuery.data.total > items.length && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {items.length} of {billsQuery.data.total} bills
        </p>
      )}
    </div>
  );
}
