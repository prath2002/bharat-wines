"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Check, FileUp, Loader2, Plus, Sparkles, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { ChargeItem } from "@/types/bill";
import {
  BillManualCreatePayload, createManualBill, getDueDateRecommendation, listVendors,
} from "@/services/bills";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

interface FormState {
  bill_number: string;
  bill_date: string;
  vendor_id: string;
  vendor_name_new: string;
  subtotal: string;
  discount_amount: string;
  charges: { label: string; amount: string }[];
  total_amount: string;
  due_date: string;
  due_date_source: "VENDOR_DEFAULT" | "MANUAL" | "";
  notes: string;
}

const emptyForm: FormState = {
  bill_number: "",
  bill_date: "",
  vendor_id: "",
  vendor_name_new: "",
  subtotal: "",
  discount_amount: "",
  charges: [],
  total_amount: "",
  due_date: "",
  due_date_source: "",
  notes: "",
};

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

export default function ManualBillEntryPage() {
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: listVendors, enabled: canReview });

  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recommendationQuery = useQuery({
    queryKey: ["due-date-recommendation", form.vendor_id, form.bill_date],
    queryFn: () => getDueDateRecommendation(form.vendor_id, form.bill_date),
    enabled: canReview && !!form.vendor_id && !!form.bill_date,
  });
  const recommendedDate = recommendationQuery.data?.due_date;
  const showRecommendation = !!recommendedDate && form.due_date !== recommendedDate;

  const computed = useMemo(() => {
    const subtotal = parseFloat(form.subtotal);
    if (Number.isNaN(subtotal)) return null;
    const discount = parseFloat(form.discount_amount) || 0;
    const charges = form.charges.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    return subtotal - discount + charges;
  }, [form.subtotal, form.discount_amount, form.charges]);

  const total = parseFloat(form.total_amount);
  const hasMismatch = computed !== null && !Number.isNaN(total) && Math.abs(computed - total) > 1;

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: BillManualCreatePayload = {
        bill_number: form.bill_number || null,
        bill_date: form.bill_date || null,
        vendor_id: form.vendor_id || null,
        vendor_name: !form.vendor_id ? form.vendor_name_new || null : null,
        subtotal: form.subtotal ? parseFloat(form.subtotal) : null,
        discount_amount: parseFloat(form.discount_amount) || 0,
        charges: form.charges
          .filter((c) => c.label || c.amount)
          .map((c): ChargeItem => ({ label: c.label || "Charge", amount: parseFloat(c.amount) || 0 })),
        total_amount: parseFloat(form.total_amount),
        due_date: form.due_date || null,
        due_date_source: form.due_date_source || null,
        notes: form.notes || null,
      };
      return createManualBill(payload, file);
    },
    onSuccess: (bill) => router.push(`/finance/bills/${bill.id}`),
    onError: (e: unknown) => setError(apiErrorDetail(e, "Failed to create the bill")),
  });

  if (!canReview) return null;

  const canSubmit =
    !!form.total_amount && parseFloat(form.total_amount) > 0 && !hasMismatch && !createMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto py-10 px-4"
    >
      <div className="mb-8">
        <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={() => router.push("/finance/bills")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Bills
        </Button>
        <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground">Manual Bill Entry</h2>
        <p className="text-muted-foreground mt-2 max-w-prose">
          Enter a supplier bill by hand — no photo or AI reading required. Useful for bills without a physical
          document, or when the scan didn&apos;t come out well.
        </p>
      </div>

      <Card className="border-border/50 shadow-lg bg-card/60 backdrop-blur-md">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-base">Bill details</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {error && (
            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="bill_number">Bill number</Label>
              <Input id="bill_number" value={form.bill_number}
                onChange={(e) => setForm({ ...form, bill_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bill_date">Bill date</Label>
              <Input id="bill_date" type="date" value={form.bill_date}
                onChange={(e) => setForm({ ...form, bill_date: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendor">Vendor</Label>
            <select
              id="vendor"
              className={selectClass}
              value={form.vendor_id}
              onChange={(e) => setForm({ ...form, vendor_id: e.target.value, vendor_name_new: "" })}
            >
              <option value="">— Select a vendor —</option>
              {(vendorsQuery.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            {!form.vendor_id && (
              <div className="pt-1">
                <Label htmlFor="vendor_new" className="text-muted-foreground">…or create a new vendor</Label>
                <Input id="vendor_new" className="mt-1.5" placeholder="New vendor name"
                  value={form.vendor_name_new}
                  onChange={(e) => setForm({ ...form, vendor_name_new: e.target.value })} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="subtotal">Subtotal (₹)</Label>
              <Input id="subtotal" type="number" inputMode="decimal" value={form.subtotal}
                onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discount">Discount (₹)</Label>
              <Input id="discount" type="number" inputMode="decimal" value={form.discount_amount}
                onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional charges</Label>
            {form.charges.length === 0 && (
              <p className="text-sm text-muted-foreground">No extra charges on this bill.</p>
            )}
            {form.charges.map((charge, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Label (Freight, TCS…)"
                  value={charge.label}
                  onChange={(e) => {
                    const charges = [...form.charges];
                    charges[i] = { ...charges[i], label: e.target.value };
                    setForm({ ...form, charges });
                  }}
                />
                <Input
                  className="w-32"
                  type="number"
                  inputMode="decimal"
                  placeholder="₹"
                  value={charge.amount}
                  onChange={(e) => {
                    const charges = [...form.charges];
                    charges[i] = { ...charges[i], amount: e.target.value };
                    setForm({ ...form, charges });
                  }}
                />
                <Button variant="ghost" size="icon" aria-label="Remove charge"
                  onClick={() => setForm({ ...form, charges: form.charges.filter((_, j) => j !== i) })}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm"
              onClick={() => setForm({ ...form, charges: [...form.charges, { label: "", amount: "" }] })}>
              <Plus className="h-4 w-4 mr-1" /> Add charge
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="total">Grand total (₹)</Label>
            <Input id="total" type="number" inputMode="decimal" value={form.total_amount} className="font-semibold"
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          </div>

          {computed !== null && (
            hasMismatch ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Grand total doesn&apos;t match subtotal − discount + charges. Fix the amounts to continue.</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Amounts add up
              </p>
            )
          )}

          <div className="space-y-1.5">
            <Label htmlFor="due">Due date</Label>
            <Input id="due" type="date" value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value, due_date_source: "MANUAL" })} />
            {showRecommendation && (
              <button
                type="button"
                className="mt-1.5 flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
                onClick={() => setForm({ ...form, due_date: recommendedDate!, due_date_source: "VENDOR_DEFAULT" })}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Suggested: {recommendedDate} ({recommendationQuery.data?.payment_terms_days}-day terms) — Use this
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes} placeholder="Anything the finance team should know"
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="file">Attachment (optional)</Label>
            {file ? (
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                <span className="text-sm text-foreground truncate">{file.name}</span>
                <Button variant="ghost" size="icon" aria-label="Remove attachment" onClick={() => setFile(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2.5 text-sm text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/30">
                <FileUp className="h-4 w-4" />
                Attach a scanned copy or photo
                <input id="file" type="file" accept="image/jpeg,image/png,application/pdf" className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          <Button
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80"
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create bill
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
