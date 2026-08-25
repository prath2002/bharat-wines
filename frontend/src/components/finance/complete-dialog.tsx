"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SettlementMethod } from "@/types/bill";
import { completePaymentSchedule } from "@/services/payment-schedules";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

/** Mark a scheduled payment as paid — the last step of the flow. Reference
 * ID is required here (unlike the older direct-settlement form) since this
 * is specifically "the payment went through in my bank app, log it". */
export function CompleteDialog({
  scheduleId, trigger, onCompleted,
}: {
  scheduleId: string;
  trigger?: React.ReactElement;
  onCompleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState<SettlementMethod>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) { setReference(""); setError(null); }
    setOpen(next);
  };

  const mutation = useMutation({
    mutationFn: () => completePaymentSchedule(scheduleId, { paid_on: paidOn, method, reference }),
    onSuccess: () => { toast.success("Payment marked as paid"); setOpen(false); onCompleted(); },
    onError: (e: unknown) => setError(apiErrorDetail(e, "Failed to mark as paid")),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? <Button size="sm"><CheckCircle2 className="h-4 w-4 mr-1" /> Mark as paid</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark this payment as paid</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm">{error}</div>}
          <div className="space-y-1.5">
            <Label htmlFor="cmp_date">Paid on</Label>
            <Input id="cmp_date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmp_method">Method</Label>
            <select id="cmp_method" className={selectClass} value={method} onChange={(e) => setMethod(e.target.value as SettlementMethod)}>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmp_ref">Reference ID (UTR / cheque no. / txn ID)</Label>
            <Input id="cmp_ref" value={reference} placeholder="Required" onChange={(e) => setReference(e.target.value)} />
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !reference.trim()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm paid
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
