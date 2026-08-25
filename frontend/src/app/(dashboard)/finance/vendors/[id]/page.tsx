"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Pencil } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { getVendor, getVendorStatement } from "@/services/vendors";
import { VendorFormDialog } from "@/components/finance/vendor-form";
import { formatINR } from "@/utils/currency";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "negative" }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${tone === "negative" && value > 0 ? "text-rose-700 dark:text-rose-400" : "text-foreground"}`}>
        {formatINR(value)}
      </div>
    </div>
  );
}

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const vendorQuery = useQuery({ queryKey: ["vendor", params.id], queryFn: () => getVendor(params.id), enabled: canReview });
  const statementQuery = useQuery({ queryKey: ["vendor-statement", params.id], queryFn: () => getVendorStatement(params.id), enabled: canReview });

  if (!canReview) return null;

  if (vendorQuery.isLoading || !vendorQuery.data) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  const vendor = vendorQuery.data;
  const statement = statementQuery.data;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/finance/vendors")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Vendors
          </Button>
          <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">{vendor.name}</h2>
        </div>
        <VendorFormDialog
          vendor={vendor}
          trigger={<Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-1.5" /> Edit</Button>}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Terms & contact</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 divide-y divide-border/40">
              <InfoRow label="GSTIN" value={vendor.gstin} />
              <InfoRow label="Payment terms" value={vendor.payment_terms_days != null ? `${vendor.payment_terms_days} days` : null} />
              <InfoRow label="Credit period" value={vendor.credit_period_days != null ? `${vendor.credit_period_days} days` : null} />
              <InfoRow label="Contact person" value={vendor.contact_person} />
              <InfoRow label="Phone" value={vendor.phone} />
              <InfoRow label="Email" value={vendor.email} />
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bank details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 divide-y divide-border/40">
              <InfoRow label="Account holder" value={vendor.bank_account_holder} />
              <InfoRow label="Account number" value={vendor.bank_account_number} />
              <InfoRow label="IFSC" value={vendor.bank_ifsc} />
              <InfoRow label="Bank name" value={vendor.bank_name} />
              <InfoRow label="UPI ID" value={vendor.upi_id} />
            </CardContent>
          </Card>

          {vendor.notes && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4 text-sm text-muted-foreground">{vendor.notes}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {statementQuery.isLoading || !statement ? (
            <Skeleton className="h-40 rounded-2xl" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Total billed" value={statement.total_billed} />
                <StatCard label="Total paid" value={statement.total_paid} />
                <StatCard label="Outstanding" value={statement.outstanding_amount} tone="negative" />
                <StatCard label="Overdue" value={statement.overdue_amount} tone="negative" />
              </div>

              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Upcoming payments</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {statement.upcoming_payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nothing scheduled.</p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {statement.upcoming_payments.map((p) => (
                        <li key={p.payment_schedule_id} className="py-2.5 flex items-center justify-between text-sm">
                          <div>
                            <div className="text-foreground">{p.bill_number || "Bill"}</div>
                            <div className="text-xs text-muted-foreground">{format(new Date(p.scheduled_date), "d MMM yyyy")}</div>
                          </div>
                          <span className="font-medium tabular-nums text-foreground">{formatINR(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Payment history</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {statement.payment_history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No payments recorded yet.</p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {statement.payment_history.map((p) => (
                        <li key={p.settlement_id} className="py-2.5 flex items-center justify-between text-sm">
                          <div>
                            <div className="text-foreground">{p.bill_number || "Bill"}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(p.paid_on), "d MMM yyyy")}{p.reference ? ` · ${p.reference}` : ""}
                            </div>
                          </div>
                          <span className="font-medium tabular-nums text-foreground">{formatINR(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
