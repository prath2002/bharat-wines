"use client";

import Link from "next/link";
import { CalendarClock, Clock, FileBarChart, History, ListChecks, Users } from "lucide-react";

const LINKS = [
  { href: "/finance/pending", label: "Pending Bills", icon: Clock },
  { href: "/finance/schedules", label: "Payment Schedules", icon: ListChecks },
  { href: "/finance/vendors", label: "Vendors", icon: Users },
  { href: "/finance/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/finance/history", label: "Payment History", icon: History },
  { href: "/finance/reports", label: "Reports", icon: FileBarChart },
];

export function QuickLinks() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {LINKS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-card/80 px-3 py-4 text-center hover:border-primary/40 hover:bg-muted/40 transition-colors"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-foreground">{label}</span>
        </Link>
      ))}
    </div>
  );
}
