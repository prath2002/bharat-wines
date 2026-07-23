"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle, ArrowLeft, Banknote, Check, Landmark, Loader2, Plus,
  Smartphone, Trash2, Wallet, X, FileText,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BillStatusBadge, PaymentBadge } from "@/components/finance/badges";
import { useAuthStore } from "@/store/auth-store";
import { Role } from "@/types/auth";
import { BillDetail, ChargeItem, SettlementMethod } from "@/types/bill";
import {
  addSettlement, deleteSettlement, getBill, listVendors, rejectBill, updateBill, verifyBill,
} from "@/services/bills";
import { formatINR, formatINRPrecise } from "@/utils/currency";

const METHOD_ICONS: Record<SettlementMethod, React.ReactNode> = {
  BANK_TRANSFER: <Landmark className="h-4 w-4" />,
  UPI: <Smartphone className="h-4 w-4" />,
  CASH: <Banknote className="h-4 w-4" />,
  CHEQUE: <FileText className="h-4 w-4" />,
  OTHER: <Wallet className="h-4 w-4" />,
};

const METHOD_LABELS: Record<SettlementMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CASH: "Cash",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

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
  notes: string;
}

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

export default function BillReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);
  const canReview = role === Role.ADMIN || role === Role.FINANCE;

  useEffect(() => {
    if (role && !canReview) router.replace("/finance/bills");
  }, [role, canReview, router]);

  const billQuery = useQuery({
    queryKey: ["bill", params.id],
    queryFn: () => getBill(params.id),
    enabled: canReview,
    refetchInterval: (query) =>
      (query.state.data as BillDetail | undefined)?.status === "PROCESSING" ? 4000 : false,
  });
  const bill = billQuery.data as BillDetail | undefined;

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: listVendors, enabled: canReview });

  const [form, setForm] = useState<FormState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Derived-state-during-render: seed the form once the bill has loaded.
  if (bill && bill.status !== "PROCESSING" && form === null) {
    setForm({
      bill_number: bill.bill_number ?? "",
      bill_date: bill.bill_date ?? "",
      vendor_id: bill.vendor_id ?? "",
      vendor_name_new: "",
      subtotal: bill.subtotal != null ? String(bill.subtotal) : "",
      discount_amount: String(bill.discount_amount ?? 0),
      charges: (bill.charges ?? []).map((c) => ({ label: c.label, amount: String(c.amount) })),
      total_amount: bill.total_amount != null ? String(bill.total_amount) : "",
      due_date: bill.due_date ?? "",
      notes: bill.notes ?? "",
    });
  }

  const computed = useMemo(() => {
    if (!form) return null;
    const subtotal = parseFloat(form.subtotal);
    if (Number.isNaN(subtotal)) return null;
    const discount = parseFloat(form.discount_amount) || 0;
    const charges = form.charges.reduce((acc, c) => acc + (parseFloat(c.amount) || 0), 0);
    return subtotal - discount + charges;
  }, [form]);

  const total = form ? parseFloat(form.total_amount) : NaN;
  const hasMismatch =
    computed !== null && !Number.isNaN(total) && Math.abs(computed - total) > 1;

  const buildPayload = () => ({
    bill_number: form!.bill_number || null,
    bill_date: form!.bill_date || null,
    vendor_id: form!.vendor_id || null,
    subtotal: form!.subtotal ? parseFloat(form!.subtotal) : null,
    discount_amount: parseFloat(form!.discount_amount) || 0,
    charges: form!.charges
      .filter((c) => c.label || c.amount)
      .map((c): ChargeItem => ({ label: c.label || "Charge", amount: parseFloat(c.amount) || 0 })),
    total_amount: form!.total_amount ? parseFloat(form!.total_amount) : null,
    due_date: form!.due_date || null,
    notes: form!.notes || null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bill", params.id] });
    queryClient.invalidateQueries({ queryKey: ["bills"] });
    queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => updateBill(params.id, buildPayload()),
    onSuccess: () => { setActionError(null); invalidate(); },
    onError: (e: unknown) => setActionError(apiErrorDetail(e, "Failed to save changes")),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      await updateBill(params.id, buildPayload());
      return verifyBill(params.id, form?.vendor_name_new || undefined);
    },
    onSuccess: () => { setActionError(null); setForm(null); invalidate(); },
    onError: (e: unknown) => setActionError(apiErrorDetail(e, "Failed to verify bill")),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectBill(params.id),
    onSuccess: () => { invalidate(); router.push("/finance/bills"); },
    onError: (e: unknown) => setActionError(apiErrorDetail(e, "Failed to reject bill")),
  });

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/api\/v1$/, "");

  if (!canReview) return null;

  if (billQuery.isLoading || !bill) {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        <Skeleton className="h-[70vh] rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (bill.status === "PROCESSING") {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center py-24">
        <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
        <h2 className="text-2xl font-heading font-bold text-foreground">AI is reading this bill</h2>
        <p className="text-muted-foreground mt-2">
          Totals, discounts, and the company name are being extracted. This page refreshes automatically.
        </p>
      </div>
    );
  }

  const settled = bill.amount_paid;
  const outstanding = Math.max((bill.total_amount ?? 0) - settled, 0);
  const paidPct = bill.total_amount ? Math.min((settled / bill.total_amount) * 100, 100) : 0;
  const editable = bill.status === "DRAFT";

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/finance/bills")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Bills
        </Button>
        <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">
          {bill.vendor_name || bill.extracted_vendor_name || "Bill review"}
        </h2>
        <BillStatusBadge status={bill.status} />
        {bill.status === "VERIFIED" && <PaymentBadge status={bill.payment_status} />}
      </div>

      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3 text-sm">
          {actionError}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Bill image */}
        <Card className="border-border/50 overflow-hidden lg:sticky lg:top-6">
          <CardContent className="p-0 bg-muted/30">
            {/\.(jpe?g|png|webp)$/i.test(bill.file_url) ? (
              <a href={`${apiBase}${bill.file_url}`} target="_blank" rel="noreferrer" title="Open full size">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${apiBase}${bill.file_url}`} alt="Uploaded bill" className="w-full h-auto max-h-[80vh] object-contain" />
              </a>
            ) : (
              <div className="p-16 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/60" />
                <a className="text-primary underline underline-offset-4" href={`${apiBase}${bill.file_url}`} target="_blank" rel="noreferrer">
                  Open the uploaded document
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Extracted details */}
          {form && (
            <Card className="border-border/50">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">Bill details</CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bill_number">Bill number</Label>
                    <Input id="bill_number" value={form.bill_number} disabled={!editable}
                      onChange={(e) => setForm({ ...form, bill_number: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bill_date">Bill date</Label>
                    <Input id="bill_date" type="date" value={form.bill_date} disabled={!editable}
                      onChange={(e) => setForm({ ...form, bill_date: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="vendor">Company</Label>
                  <select
                    id="vendor"
                    className={selectClass}
                    value={form.vendor_id}
                    disabled={!editable}
                    onChange={(e) => setForm({ ...form, vendor_id: e.target.value, vendor_name_new: "" })}
                  >
                    <option value="">— Select a company —</option>
                    {(vendorsQuery.data ?? []).map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  {editable && !form.vendor_id && (
                    <div className="pt-1">
                      <Label htmlFor="vendor_new" className="text-muted-foreground">
                        …or create from the extracted name
                      </Label>
                      <Input
                        id="vendor_new"
                        className="mt-1.5"
                        placeholder={bill.extracted_vendor_name ?? "New company name"}
                        value={form.vendor_name_new}
                        onChange={(e) => setForm({ ...form, vendor_name_new: e.target.value })}
                      />
                      {bill.extracted_vendor_name && !form.vendor_name_new && (
                        <button
                          type="button"
                          className="mt-1.5 text-sm text-primary hover:underline underline-offset-4"
                          onClick={() => setForm({ ...form, vendor_name_new: bill.extracted_vendor_name! })}
                        >
                          Use “{bill.extracted_vendor_name}”
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="subtotal">Subtotal (₹)</Label>
                    <Input id="subtotal" type="number" inputMode="decimal" value={form.subtotal} disabled={!editable}
                      onChange={(e) => setForm({ ...form, subtotal: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="discount">Discount (₹)</Label>
                    <Input id="discount" type="number" inputMode="decimal" value={form.discount_amount} disabled={!editable}
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
                        disabled={!editable}
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
                        disabled={!editable}
                        onChange={(e) => {
                          const charges = [...form.charges];
                          charges[i] = { ...charges[i], amount: e.target.value };
                          setForm({ ...form, charges });
                        }}
                      />
                      {editable && (
                        <Button
                          variant="ghost" size="icon" aria-label="Remove charge"
                          onClick={() => setForm({ ...form, charges: form.charges.filter((_, j) => j !== i) })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editable && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setForm({ ...form, charges: [...form.charges, { label: "", amount: "" }] })}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add charge
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="total">Grand total (₹)</Label>
                    <Input id="total" type="number" inputMode="decimal" value={form.total_amount} disabled={!editable}
                      className="font-semibold"
                      onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="due">Due date</Label>
                    <Input id="due" type="date" value={form.due_date} disabled={!editable}
                      onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>

                {computed !== null && (
                  hasMismatch ? (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        Grand total {formatINRPrecise(total)} doesn&apos;t match the computed{" "}
                        <strong>{formatINRPrecise(computed)}</strong> (subtotal − discount + charges). Fix the amounts before verifying.
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Amounts add up: {formatINRPrecise(computed)}
                    </p>
                  )
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Input id="notes" value={form.notes} disabled={!editable}
                    placeholder="Anything the finance team should know"
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>

                {editable && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                      {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save draft
                    </Button>
                    <Button
                      onClick={() => verifyMutation.mutate()}
                      disabled={verifyMutation.isPending || hasMismatch || (!form.vendor_id && !form.vendor_name_new)}
                      className="bg-gradient-to-r from-primary to-primary/80"
                      title={
                        hasMismatch ? "Fix the total mismatch first"
                        : !form.vendor_id && !form.vendor_name_new ? "Pick or create a company first"
                        : undefined
                      }
                    >
                      {verifyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Check className="h-4 w-4 mr-1" /> Verify bill
                    </Button>
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10"
                      onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending}>
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Settlements */}
          {bill.status === "VERIFIED" && (
            <SettlementsCard
              bill={bill}
              settled={settled}
              outstanding={outstanding}
              paidPct={paidPct}
              onChanged={invalidate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SettlementsCard({
  bill, settled, outstanding, paidPct, onChanged,
}: {
  bill: BillDetail;
  settled: number;
  outstanding: number;
  paidPct: number;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState({
    amount: "",
    paid_on: format(new Date(), "yyyy-MM-dd"),
    method: "BANK_TRANSFER" as SettlementMethod,
    reference: "",
    notes: "",
  });

  const handleOpenChange = (next: boolean) => {
    if (next) setPayment((p) => ({ ...p, amount: outstanding > 0 ? String(outstanding) : "" }));
    setOpen(next);
  };

  const addMutation = useMutation({
    mutationFn: () =>
      addSettlement(bill.id, {
        amount: parseFloat(payment.amount),
        paid_on: payment.paid_on,
        method: payment.method,
        reference: payment.reference || undefined,
        notes: payment.notes || undefined,
      }),
    onSuccess: () => { setError(null); setOpen(false); onChanged(); },
    onError: (e: unknown) => setError(apiErrorDetail(e, "Failed to record payment")),
  });

  const removeMutation = useMutation({
    mutationFn: (settlementId: string) => deleteSettlement(settlementId),
    onSuccess: onChanged,
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Payments</CardTitle>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger
            render={
              <Button size="sm" disabled={outstanding <= 0}>
                <Plus className="h-4 w-4 mr-1" /> Record payment
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record a payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pay_amount">Amount (₹)</Label>
                  <Input id="pay_amount" type="number" inputMode="decimal" value={payment.amount}
                    onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay_date">Paid on</Label>
                  <Input id="pay_date" type="date" value={payment.paid_on}
                    onChange={(e) => setPayment({ ...payment, paid_on: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay_method">Method</Label>
                <select
                  id="pay_method"
                  className={selectClass}
                  value={payment.method}
                  onChange={(e) => setPayment({ ...payment, method: e.target.value as SettlementMethod })}
                >
                  {Object.entries(METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay_ref">Reference (UTR / cheque no.)</Label>
                <Input id="pay_ref" value={payment.reference} placeholder="Optional"
                  onChange={(e) => setPayment({ ...payment, reference: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay_notes">Notes</Label>
                <Input id="pay_notes" value={payment.notes} placeholder="Optional"
                  onChange={(e) => setPayment({ ...payment, notes: e.target.value })} />
              </div>
              <Button
                className="w-full"
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !payment.amount || parseFloat(payment.amount) <= 0}
              >
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              Paid <strong className="text-foreground tabular-nums">{formatINR(settled)}</strong> of{" "}
              <strong className="text-foreground tabular-nums">{formatINR(bill.total_amount)}</strong>
            </span>
            <span className={`font-medium tabular-nums ${outstanding > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
              {outstanding > 0 ? `${formatINR(outstanding)} due` : "Settled"}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar"
            aria-valuenow={Math.round(paidPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Payment progress">
            <div
              className={`h-full rounded-full transition-all duration-300 ${paidPct >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>

        {bill.settlements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {bill.settlements.map((s) => (
              <li key={s.id} className="py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  {METHOD_ICONS[s.method]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground tabular-nums">{formatINRPrecise(s.amount)}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {format(new Date(s.paid_on), "d MMM yyyy")} · {METHOD_LABELS[s.method]}
                    {s.reference ? ` · ${s.reference}` : ""}
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon" aria-label="Delete payment"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeMutation.mutate(s.id)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {bill.notes && (
          <p className="text-sm text-muted-foreground border-t border-border/50 pt-4">
            <Badge variant="outline" className="mr-2">Note</Badge>
            {bill.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
