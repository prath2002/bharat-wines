"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";

const FINANCE_ROLES = [Role.ADMIN, Role.FINANCE];

const TABS = [
  { href: "/finance", label: "Dashboard" },
  { href: "/finance/bills", label: "Bills" },
  { href: "/finance/vendors", label: "Vendors" },
  { href: "/finance/schedules", label: "Schedules" },
  { href: "/finance/calendar", label: "Calendar" },
  { href: "/finance/history", label: "History" },
  { href: "/finance/reports", label: "Reports" },
];

/** Shared shell for all /finance/* routes. STAFF only ever deep-links into
 * /finance/bills or /finance/bills/upload (both individually guarded), so the
 * tab bar itself is ADMIN/FINANCE-only rather than gating the whole section —
 * gating here would break STAFF's existing bill-upload access. */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((state) => state.user?.role);
  const pathname = usePathname();
  const showNav = !!role && FINANCE_ROLES.includes(role);

  if (!showNav) return <>{children}</>;

  return (
    <div>
      <div className="border-b border-border/50 bg-card/40 backdrop-blur-md sticky top-0 z-30">
        <nav className="max-w-7xl mx-auto px-4 md:px-8 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((tab) => {
            const active = tab.href === "/finance" ? pathname === "/finance" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 px-3.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
