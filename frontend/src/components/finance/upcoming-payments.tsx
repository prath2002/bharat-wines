"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isToday, parseISO } from "date-fns";
import { CalendarClock, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaymentCalendar, getPaymentHistory, getPendingBills } from "@/services/finance";
import { listPaymentSchedules } from "@/services/payment-schedules";
import { formatINR } from "@/utils/currency";
import { ScheduleDialog } from "@/components/finance/schedule-dialog";
import { CompleteDialog } from "@/components/finance/complete-dialog";
import { Button } from "@/components/ui/button";
import { PaymentScheduleStatus } from "@/types/payment";

const TERMINAL_SCHEDULE_STATUSES = new Set(["PAID", "CANCELLED", "FAILED"]);

/** Red = due and not yet scheduled. Yellow = scheduled but not paid.
 * Green = paid. Used for the color-coded cards on the full calendar page. */
const TONE_CLASSES = {
  red: "border-rose-500/30 bg-rose-500/10",
  yellow: "border-amber-500/30 bg-amber-500/10",
  green: "border-emerald-500/30 bg-emerald-500/10",
} as const;
const TONE_TEXT = {
  red: "text-rose-700 dark:text-rose-400",
  yellow: "text-amber-700 dark:text-amber-400",
  green: "text-emerald-700 dark:text-emerald-400",
} as const;
type Tone = keyof typeof TONE_CLASSES;

export function UpcomingPayments({
  vendorId,
  daysAhead = 14,
  offsetDays = 0,
  maxRows,
  showViewAllLink = true,
  enableScheduling = false,
}: {
  vendorId?: string;
  /** How many days ahead to fetch, starting from the window start. */
  daysAhead?: number;
  /** Shift the window start away from today — used for prev/next navigation. */
  offsetDays?: number;
  /** Cap the number of date-rows rendered — used for the dashboard preview. */
  maxRows?: number;
  /** Hide the "View full calendar" link — used on the full calendar page itself. */
  showViewAllLink?: boolean;
  /** Show a "Schedule" button on each due bill — off on the dashboard preview
   * to keep it uncluttered, on for the full calendar page. */
  enableScheduling?: boolean;
}) {
  const queryClient = useQueryClient();
  const windowStart = useMemo(() => addDays(new Date(), offsetDays), [offsetDays]);
  const dateFrom = format(windowStart, "yyyy-MM-dd");
  const dateTo = format(addDays(windowStart, daysAhead), "yyyy-MM-dd");

  const calendarQuery = useQuery({
    queryKey: ["payment-calendar", dateFrom, dateTo, vendorId],
    queryFn: () => getPaymentCalendar({ date_from: dateFrom, date_to: dateTo, vendor_id: vendorId }),
  });
  const pendingQuery = useQuery({
    queryKey: ["pending-bills", vendorId],
    queryFn: () => getPendingBills(vendorId),
  });
  // Not date-bound — a bill can already have an active schedule dated outside
  // this window, and it should still be hidden from "needs scheduling".
  const activeSchedulesQuery = useQuery({
    queryKey: ["payment-schedules", "active-by-bill", vendorId],
    queryFn: () => listPaymentSchedules({ vendor_id: vendorId }),
    enabled: enableScheduling,
  });
  // Completed payments in this window, so a bill that got paid still shows
  // (green) on the day it was paid instead of just disappearing.
  const paymentHistoryQuery = useQuery({
    queryKey: ["payment-history", "for-calendar", dateFrom, dateTo, vendorId],
    queryFn: () => getPaymentHistory({ date_from: dateFrom, date_to: dateTo, vendor_id: vendorId }),
    enabled: enableScheduling,
  });

  const scheduleByBillId = useMemo(() => {
    const map = new Map<string, { id: string; status: PaymentScheduleStatus }>();
    (activeSchedulesQuery.data ?? [])
      .filter((s) => !TERMINAL_SCHEDULE_STATUSES.has(s.status))
      .forEach((s) => map.set(s.bill_id, { id: s.id, status: s.status }));
    return map;
  }, [activeSchedulesQuery.data]);

  const handleChanged = () => {
    queryClient.invalidateQueries({ queryKey: ["payment-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["pending-bills"] });
    queryClient.invalidateQueries({ queryKey: ["payment-schedules"] });
  };

  const days = useMemo(() => {
    const scheduled = calendarQuery.data ?? [];
    const pending = (pendingQuery.data ?? []).filter((b) => b.due_date);
    const paid = paymentHistoryQuery.data ?? [];

    const dateKeys = new Set<string>();
    scheduled.forEach((d) => dateKeys.add(d.scheduled_date));
    paid.forEach((p) => dateKeys.add(p.paid_on));
    pending.forEach((b) => {
      if (b.days_remaining !== null && b.days_remaining >= offsetDays && b.days_remaining <= offsetDays + daysAhead) {
        dateKeys.add(b.due_date!);
      }
    });

    return Array.from(dateKeys)
      .sort()
      .map((dateKey) => {
        const date = parseISO(dateKey);
        const scheduledDay = scheduled.find((d) => d.scheduled_date === dateKey);
        const dueBills = pending.filter((b) => b.due_date === dateKey);
        const paidItems = paid.filter((p) => p.paid_on === dateKey);
        return {
          date,
          dateKey,
          scheduledCount: scheduledDay?.items.length ?? 0,
          scheduledTotal: scheduledDay?.total ?? 0,
          scheduledItems: scheduledDay?.items ?? [],
          dueCount: dueBills.length,
          dueTotal: dueBills.reduce((acc, b) => acc + b.outstanding, 0),
          dueItems: dueBills,
          paidCount: paidItems.length,
          paidTotal: paidItems.reduce((acc, p) => acc + p.amount, 0),
          paidItems,
        };
      });
  }, [calendarQuery.data, pendingQuery.data, paymentHistoryQuery.data, daysAhead, offsetDays]);

  const visibleDays = maxRows ? days.slice(0, maxRows) : days;
  const isLoading = calendarQuery.isLoading || pendingQuery.isLoading;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Upcoming payments
        </CardTitle>
        {showViewAllLink && maxRows && (
          <Link href="/finance/calendar" className="text-sm text-primary hover:underline underline-offset-4">
            View full calendar →
          </Link>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : visibleDays.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nothing due or scheduled in the next {daysAhead} days.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {visibleDays.map((day) => (
              <li key={day.dateKey} className={isToday(day.date) ? "bg-primary/5" : undefined}>
                <div className="px-5 py-3.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isToday(day.date) ? "text-primary" : "text-foreground"}`}>
                      {isToday(day.date) ? "Today" : format(day.date, "EEE, d MMM")}
                    </span>
                    {isToday(day.date) && (
                      <span className="text-[10px] uppercase tracking-wide bg-primary/15 text-primary rounded-full px-2 py-0.5">
                        {format(day.date, "d MMM")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    {day.dueCount > 0 && (
                      <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                        <Clock className="h-3.5 w-3.5" />
                        {day.dueCount} bill{day.dueCount === 1 ? "" : "s"} due · {formatINR(day.dueTotal)}
                      </span>
                    )}
                    {day.scheduledCount > 0 && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {day.scheduledCount} scheduled · {formatINR(day.scheduledTotal)}
                      </span>
                    )}
                  </div>

                  {enableScheduling ? (
                    <div className="space-y-1.5">
                      {day.dueItems.map((b) => {
                        const tone: Tone = scheduleByBillId.has(b.id) ? "yellow" : "red";
                        return (
                          <div key={b.id} className={`flex items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 ${TONE_CLASSES[tone]}`}>
                            <Link href={`/finance/bills/${b.id}`}
                              className={`text-xs hover:underline underline-offset-4 ${TONE_TEXT[tone]}`}>
                              {b.vendor_name ?? "Unknown vendor"} · {formatINR(b.outstanding)}
                            </Link>
                            {scheduleByBillId.has(b.id) ? (
                              <CompleteDialog
                                scheduleId={scheduleByBillId.get(b.id)!.id}
                                onCompleted={handleChanged}
                                trigger={<Button size="sm" variant="outline" className="h-6 px-2 text-xs">Mark paid</Button>}
                              />
                            ) : (
                              <ScheduleDialog
                                billId={b.id}
                                amount={b.outstanding}
                                defaultDate={b.due_date}
                                onScheduled={handleChanged}
                                trigger={<Button size="sm" variant="outline" className="h-6 px-2 text-xs">Schedule</Button>}
                              />
                            )}
                          </div>
                        );
                      })}
                      {day.scheduledItems
                        .filter((s) => !day.dueItems.some((b) => b.id === s.bill_id))
                        .map((s) => (
                          <div key={s.payment_schedule_id} className={`flex items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 ${TONE_CLASSES.yellow}`}>
                            <Link href={`/finance/bills/${s.bill_id}`}
                              className={`text-xs hover:underline underline-offset-4 ${TONE_TEXT.yellow}`}>
                              {s.vendor_name ?? "Unknown vendor"} · {formatINR(s.amount)} (scheduled)
                            </Link>
                            <CompleteDialog
                              scheduleId={s.payment_schedule_id}
                              onCompleted={handleChanged}
                              trigger={<Button size="sm" variant="outline" className="h-6 px-2 text-xs">Mark paid</Button>}
                            />
                          </div>
                        ))}
                      {day.paidItems.map((p) => (
                        <Link key={p.settlement_id} href={`/finance/bills/${p.bill_id}`}
                          className={`flex items-center justify-between gap-3 rounded-lg border px-2.5 py-1.5 ${TONE_CLASSES.green}`}>
                          <span className={`text-xs hover:underline underline-offset-4 ${TONE_TEXT.green}`}>
                            {p.vendor_name ?? "Unknown vendor"} · {formatINR(p.amount)} (paid)
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {day.dueItems.map((b) => (
                        <Link key={b.id} href={`/finance/bills/${b.id}`}
                          className="text-xs text-muted-foreground hover:text-primary hover:underline underline-offset-4">
                          {b.vendor_name ?? "Unknown vendor"} · {formatINR(b.outstanding)}
                        </Link>
                      ))}
                      {day.scheduledItems.map((s) => (
                        <Link key={s.payment_schedule_id} href={`/finance/bills/${s.bill_id}`}
                          className="text-xs text-muted-foreground hover:text-primary hover:underline underline-offset-4">
                          {s.vendor_name ?? "Unknown vendor"} · {formatINR(s.amount)} ({s.status.toLowerCase().replace("_", " ")})
                        </Link>
                      ))}
                    </div>
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
