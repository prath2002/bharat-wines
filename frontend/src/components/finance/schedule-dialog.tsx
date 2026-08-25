"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createPaymentSchedule } from "@/services/payment-schedules";

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

/** Create-a-payment-schedule dialog, reused from the bill detail page and
 * from date-grouped due-bill lists (e.g. the payment calendar). */
export function ScheduleDialog({
  billId,
  amount,
  defaultDate,
  trigger,
  onScheduled,
}: {
  billId: string;
  /** The bill's full outstanding amount — payments are all-or-nothing, so
   * this isn't user-editable, just shown for confirmation. */
  amount: number;
  /** Bill's due date — prefilled as the scheduled date; the user can still edit it. Falls back to today if the bill has no due date. */
  defaultDate?: string | null;
  trigger?: React.ReactElement;
  onScheduled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(defaultDate || format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) setScheduledDate(defaultDate || format(new Date(), "yyyy-MM-dd"));
    setError(null);
    setOpen(next);
  };

  const mutation = useMutation({
    mutationFn: () => createPaymentSchedule(billId, { amount, scheduled_date: scheduledDate, notes: notes || undefined }),
    onSuccess: () => { toast.success("Payment scheduled"); setOpen(false); setNotes(""); onScheduled(); },
    onError: (e: unknown) => setError(apiErrorDetail(e, "Failed to schedule payment")),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger ?? <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Schedule a payment</Button>} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule a payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sch_amount">Amount (₹)</Label>
              <Input id="sch_amount" value={`₹${Intl.NumberFormat("en-IN").format(amount)}`} disabled className="font-medium" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sch_date">Scheduled date</Label>
              <Input id="sch_date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Bills are paid in full — partial payments aren&apos;t supported.</p>
          <div className="space-y-1.5">
            <Label htmlFor="sch_notes">Notes</Label>
            <Input id="sch_notes" value={notes} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || amount <= 0}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
