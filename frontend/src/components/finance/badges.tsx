import { Badge } from "@/components/ui/badge";
import { BillStatus, PaymentStatus } from "@/types/bill";

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
