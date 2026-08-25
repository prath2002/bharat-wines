"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { listVendors } from "@/services/bills";
import { UpcomingPayments } from "@/components/finance/upcoming-payments";

const WINDOW_DAYS = 14;

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

export default function PaymentCalendarPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const [offsetDays, setOffsetDays] = useState(0);
  const [vendorId, setVendorId] = useState("");

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: listVendors, enabled: canReview });

  if (!canReview) return null;

  const windowStart = addDays(new Date(), offsetDays);
  const windowEnd = addDays(windowStart, WINDOW_DAYS);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Payment Calendar</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">
            Bills due and payments scheduled, day by day.
          </p>
        </div>
        <select className={selectClass} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
          <option value="">All vendors</option>
          {(vendorsQuery.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>

      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setOffsetDays(offsetDays - WINDOW_DAYS)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="text-sm font-medium text-foreground flex items-center gap-2">
            {format(windowStart, "d MMM")} – {format(windowEnd, "d MMM yyyy")}
            {offsetDays !== 0 && (
              <button
                type="button"
                onClick={() => setOffsetDays(0)}
                className="text-muted-foreground hover:text-primary"
                aria-label="Back to today"
                title="Back to today"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOffsetDays(offsetDays + WINDOW_DAYS)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      <UpcomingPayments
        vendorId={vendorId || undefined}
        daysAhead={WINDOW_DAYS}
        offsetDays={offsetDays}
        showViewAllLink={false}
        enableScheduling
      />
    </div>
  );
}
