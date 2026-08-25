"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Clock, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { PaymentApproval } from "@/types/payment";
import { approvePayment, holdPayment, listPaymentApprovals, rejectPayment } from "@/services/payment-approvals";
import { listPaymentSchedules } from "@/services/payment-schedules";
import { PaymentSchedule } from "@/types/payment";

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

function ApprovalCard({
  approval, schedule, onChanged,
}: {
  approval: PaymentApproval;
  schedule?: PaymentSchedule;
  onChanged: () => void;
}) {
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payment-approvals"] });
    queryClient.invalidateQueries({ queryKey: ["payment-schedules"] });
    onChanged();
  };

  const approveMutation = useMutation({
    mutationFn: () => approvePayment(approval.id, notes || undefined),
    onSuccess: () => { toast.success("Payment approved"); invalidate(); },
    onError: (e: unknown) => toast.error(apiErrorDetail(e, "Failed to approve")),
  });
  const rejectMutation = useMutation({
    mutationFn: () => rejectPayment(approval.id, notes || undefined),
    onSuccess: () => { toast.success("Payment rejected"); invalidate(); },
    onError: (e: unknown) => toast.error(apiErrorDetail(e, "Failed to reject")),
  });
  const holdMutation = useMutation({
    mutationFn: () => holdPayment(approval.id, notes || undefined),
    onSuccess: () => { toast.success("Payment put on hold"); invalidate(); },
    onError: (e: unknown) => toast.error(apiErrorDetail(e, "Failed to put on hold")),
  });

  const pending = approveMutation.isPending || rejectMutation.isPending || holdMutation.isPending;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold text-foreground">{schedule?.vendor_name ?? "Loading…"}</div>
            {schedule && (
              <div className="text-sm text-muted-foreground mt-0.5">
                ₹{Intl.NumberFormat("en-IN").format(schedule.amount)} · scheduled {format(new Date(schedule.scheduled_date), "d MMM yyyy")}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> requested {format(new Date(approval.created_at), "d MMM")}
          </div>
        </div>

        <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => approveMutation.mutate()} disabled={pending}>
            {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => holdMutation.mutate()} disabled={pending}>
            On hold
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => rejectMutation.mutate()} disabled={pending}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApprovalsPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const approvalsQuery = useQuery({
    queryKey: ["payment-approvals", "PENDING"],
    queryFn: () => listPaymentApprovals("PENDING"),
    enabled: canReview,
  });
  const schedulesQuery = useQuery({
    queryKey: ["payment-schedules"],
    queryFn: () => listPaymentSchedules(),
    enabled: canReview,
  });

  if (!canReview) return null;

  const approvals = approvalsQuery.data ?? [];
  const scheduleById = new Map((schedulesQuery.data ?? []).map((s) => [s.id, s]));

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Approvals</h2>
        <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">
          Payments waiting for a decision. Approving moves them to ready-to-pay; rejecting cancels the schedule.
        </p>
      </div>

      {approvalsQuery.isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : approvals.length === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Check className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            Nothing waiting for approval right now.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              schedule={scheduleById.get(a.payment_schedule_id)}
              onChanged={() => approvalsQuery.refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
