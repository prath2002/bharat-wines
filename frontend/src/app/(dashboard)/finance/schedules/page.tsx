"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { PaymentScheduleStatus } from "@/types/payment";
import { listVendors } from "@/services/bills";
import { cancelPaymentSchedule, listPaymentSchedules } from "@/services/payment-schedules";
import { ScheduleStatusBadge } from "@/components/finance/badges";
import { CompleteDialog } from "@/components/finance/complete-dialog";
import { formatINR } from "@/utils/currency";

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

const STATUS_OPTIONS: PaymentScheduleStatus[] = ["SCHEDULED", "PAID", "ON_HOLD", "CANCELLED", "FAILED"];

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

export default function PaymentSchedulesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const [status, setStatus] = useState<PaymentScheduleStatus | "">("");
  const [vendorId, setVendorId] = useState("");

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: listVendors, enabled: canReview });
  const schedulesQuery = useQuery({
    queryKey: ["payment-schedules", status, vendorId],
    queryFn: () => listPaymentSchedules({ status: status || undefined, vendor_id: vendorId || undefined }),
    enabled: canReview,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payment-schedules"] });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPaymentSchedule(id),
    onSuccess: () => { toast.success("Schedule cancelled"); invalidate(); },
    onError: (e: unknown) => toast.error(apiErrorDetail(e, "Failed to cancel schedule")),
  });

  if (!canReview) return null;

  const schedules = schedulesQuery.data ?? [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Payment Schedules</h2>
        <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">
          Bills scheduled for payment. Mark one paid once you&apos;ve sent it in your bank app.
        </p>
      </div>

      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as PaymentScheduleStatus | "")}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
          <select className={selectClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">All vendors</option>
            {(vendorsQuery.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-md bg-card/80 backdrop-blur-md">
        <CardContent className="p-0">
          {schedulesQuery.isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No payment schedules match these filters.</div>
          ) : (
            <ul className="divide-y divide-border/40">
              {schedules.map((s) => (
                <li key={s.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{s.vendor_name ?? "Unknown vendor"}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatINR(s.amount)} · {format(new Date(s.scheduled_date), "d MMM yyyy")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScheduleStatusBadge status={s.status} />
                    {(s.status === "PENDING" || s.status === "SCHEDULED" || s.status === "APPROVED") && (
                      <>
                        <CompleteDialog scheduleId={s.id} onCompleted={invalidate} />
                        <Button size="icon" variant="ghost" aria-label="Cancel schedule" className="text-muted-foreground hover:text-destructive"
                          onClick={() => cancelMutation.mutate(s.id)} disabled={cancelMutation.isPending}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
