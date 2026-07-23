"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const emptySubscribe = () => () => {};
/** True after hydration on the client, false during SSR — no effect needed. */
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/**
 * Chart colors validated with the dataviz palette validator against both
 * surfaces (light card #FFFFFF/#FCFCFB, dark card #0F172A):
 * - light: billed #0284C7 / paid #10B981; status emerald/amber/rose 500s
 * - dark:  darker steps to stay inside the dark lightness band (L 0.48-0.67)
 * Identity is never color-alone: every chart ships a legend + direct labels.
 */
export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";

  return {
    billed: "#0284C7",
    paid: dark ? "#059669" : "#10B981",
    status: {
      PAID: dark ? "#059669" : "#10B981",
      PARTIALLY_PAID: dark ? "#D97706" : "#F59E0B",
      UNPAID: dark ? "#E11D48" : "#F43F5E",
    },
    grid: dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.15)",
    axis: dark ? "#94A3B8" : "#64748B",
    tooltipBg: dark ? "#0F172A" : "#FFFFFF",
    tooltipBorder: dark ? "#1E293B" : "#E2E8F0",
    ink: dark ? "#F8FAFC" : "#020617",
  };
}
