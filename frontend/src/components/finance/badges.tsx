import { Badge } from "@/components/ui/badge";
import { BillStatus, PaymentStatus } from "@/types/bill";
import { ApprovalStatus, PaymentScheduleStatus } from "@/types/payment";

export function BillStatusBadge({ status }: { status: BillStatus }) {
  switch (status) {
    case "PROCESSING":
      return (
        <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 animate-pulse">
          Reading (AI)
        </Badge>
      );
    case "DRAFT":
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
          Review Required
        </Badge>
      );
    case "VERIFIED":
      return (
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
          Verified
        </Badge>
      );
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
  }
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case "PAID":
      return (
        <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
          Paid
        </Badge>
      );
    case "PARTIALLY_PAID":
      return (
        <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
          Partial
        </Badge>
      );
    case "UNPAID":
      return (
        <Badge variant="secondary" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20">
          Unpaid
        </Badge>
      );
  }
}

const SCHEDULE_STATUS_LABELS: Record<PaymentScheduleStatus, string> = {
  PENDING: "Pending",
  SCHEDULED: "Scheduled",
  APPROVAL_PENDING: "Approval pending",
  APPROVED: "Approved",
  PAID: "Paid",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
  FAILED: "Failed",
};

const SCHEDULE_STATUS_CLASSES: Record<PaymentScheduleStatus, string> = {
  PENDING: "bg-muted text-muted-foreground border-border/50",
  SCHEDULED: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  APPROVAL_PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  APPROVED: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
  PAID: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  ON_HOLD: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  CANCELLED: "bg-muted text-muted-foreground border-border/50",
  FAILED: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
};

export function ScheduleStatusBadge({ status }: { status: PaymentScheduleStatus }) {
  return (
    <Badge variant="secondary" className={SCHEDULE_STATUS_CLASSES[status]}>
      {SCHEDULE_STATUS_LABELS[status]}
    </Badge>
  );
}

const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ON_HOLD: "On hold",
};

const APPROVAL_STATUS_CLASSES: Record<ApprovalStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  REJECTED: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  ON_HOLD: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <Badge variant="secondary" className={APPROVAL_STATUS_CLASSES[status]}>
      {APPROVAL_STATUS_LABELS[status]}
    </Badge>
  );
}
