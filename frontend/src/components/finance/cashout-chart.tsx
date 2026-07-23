"use client";

import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, parse } from "date-fns";

import { FinanceSummary } from "@/types/bill";
import { formatINR } from "@/utils/currency";
import { useChartColors } from "@/components/finance/chart-colors";

function monthLabel(month: string): string {
  return format(parse(month, "yyyy-MM", new Date()), "MMM yy");
}

function compactINR(value: number): string {
  if (Math.abs(value) >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)}Cr`;
  if (Math.abs(value) >= 100_000) return `₹${(value / 100_000).toFixed(1)}L`;
  if (Math.abs(value) >= 1_000) return `₹${(value / 1_000).toFixed(0)}k`;
  return `₹${value}`;
}

export function CashoutChart({ summary }: { summary: FinanceSummary }) {
  const colors = useChartColors();
  const data = summary.monthly.map((m) => ({ ...m, label: monthLabel(m.month) }));

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Verified bills will chart here month by month.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={264}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: colors.axis, fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tick={{ fill: colors.axis, fontSize: 12 }}
          tickFormatter={compactINR}
        />
        <Tooltip
          cursor={{ fill: colors.grid }}
          formatter={(value, name) => [formatINR(Number(value)), name === "billed" ? "Billed" : "Paid"]}
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 12,
            color: colors.ink,
            fontSize: 13,
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ color: colors.axis, fontSize: 13 }}>{value === "billed" ? "Billed" : "Paid"}</span>
          )}
          iconType="circle"
          iconSize={9}
        />
        <Bar dataKey="billed" fill={colors.billed} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        <Bar dataKey="paid" fill={colors.paid} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
