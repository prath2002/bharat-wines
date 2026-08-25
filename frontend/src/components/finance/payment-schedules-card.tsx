"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScheduleStatusBadge } from "@/components/finance/badges";
import { ScheduleDialog } from "@/components/finance/schedule-dialog";
import { CompleteDialog } from "@/components/finance/complete-dialog";
import { cancelPaymentSchedule, listPaymentSchedules } from "@/services/payment-schedules";

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

const ACTIVE_STATUSES = new Set(["PENDING", "SCHEDULED", "APPROVED"]);

export function PaymentSchedulesCard({
  billId, dueDate, outstandingAmount,
}: {
  billId: string;
  dueDate?: string | null;
  /** Bill's full outstanding amount — schedules are always for this exact amount. */
  outstandingAmount: number;
}) {
  const queryClient = useQueryClient();
  const schedulesQuery = useQuery({
    queryKey: ["payment-schedules", "bill", billId],
    queryFn: () => listPaymentSchedules({ bill_id: billId }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payment-schedules", "bill", billId] });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPaymentSchedule(id),
    onSuccess: () => { toast.success("Schedule cancelled"); invalidate(); },
    onError: (e: unknown) => toast.error(apiErrorDetail(e, "Failed to cancel schedule")),
  });

  const schedules = schedulesQuery.data ?? [];
  const hasActiveSchedule = schedules.some((s) => ACTIVE_STATUSES.has(s.status));

  return (
    <Card className="border-border/50">
      <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Payment schedules</CardTitle>
        {!hasActiveSchedule && (
          <ScheduleDialog billId={billId} amount={outstandingAmount} defaultDate={dueDate} onScheduled={invalidate} />
        )}
      </CardHeader>
      <CardContent className="p-5">
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No payments scheduled for this bill yet.</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {schedules.map((s) => (
              <li key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground tabular-nums">₹{Intl.NumberFormat("en-IN").format(s.amount)}</div>
                  <div className="text-xs text-muted-foreground">{format(new Date(s.scheduled_date), "d MMM yyyy")}{s.notes ? ` · ${s.notes}` : ""}</div>
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
  );
}
