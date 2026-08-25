"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CalendarClock, Download, FileBarChart, History, Landmark, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { downloadReport, ReportType } from "@/services/finance";

interface ReportDef {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ElementType;
  filename: string;
}

const REPORTS: ReportDef[] = [
  { type: "pending-bills", label: "Pending Bills", description: "Every verified bill still owed.", icon: FileBarChart, filename: "pending_bills.xlsx" },
  { type: "overdue-bills", label: "Overdue Bills", description: "Past due date and unpaid.", icon: AlertTriangle, filename: "overdue_bills.xlsx" },
  { type: "payment-history", label: "Payment History", description: "Completed payments with reference.", icon: History, filename: "payment_history.xlsx" },
  { type: "scheduled-payments", label: "Scheduled Payments", description: "Upcoming planned payments.", icon: CalendarClock, filename: "scheduled_payments.xlsx" },
  { type: "vendor-wise", label: "Vendor-wise", description: "Spend and dues by vendor.", icon: Users, filename: "vendor_wise_payments.xlsx" },
  { type: "monthly", label: "Monthly", description: "Billed vs paid by month.", icon: TrendingUp, filename: "monthly_payments.xlsx" },
  { type: "aging", label: "Payables Aging", description: "Outstanding grouped by days overdue.", icon: Landmark, filename: "payables_aging.xlsx" },
];

export default function ReportsPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;
  const [downloading, setDownloading] = useState<ReportType | null>(null);

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  if (!canReview) return null;

  const handleDownload = async (report: ReportDef) => {
    setDownloading(report.type);
    try {
      await downloadReport(report.type, report.filename);
    } catch {
      toast.error(`Failed to download ${report.label}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Reports</h2>
        <p className="text-muted-foreground mt-1 text-sm md:text-base max-w-prose">
          Download any of these as an Excel file for offline review or sharing.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {REPORTS.map((report) => (
          <Card key={report.type} className="border-border/50 bg-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <report.icon className="h-4 w-4 text-primary" /> {report.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">{report.description}</p>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => handleDownload(report)}
                disabled={downloading === report.type}
              >
                <Download className="h-4 w-4 mr-1.5" />
                {downloading === report.type ? "…" : "Download"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
