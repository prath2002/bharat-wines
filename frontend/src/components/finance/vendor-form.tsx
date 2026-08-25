"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VendorFull } from "@/types/vendor";
import { createVendor, updateVendor, VendorPayload } from "@/services/vendors";

interface VendorFormState {
  name: string;
  gstin: string;
  payment_terms_days: string;
  credit_period_days: string;
  contact_person: string;
  phone: string;
  email: string;
  bank_account_holder: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  upi_id: string;
  notes: string;
}

function toFormState(vendor?: VendorFull): VendorFormState {
  return {
    name: vendor?.name ?? "",
    gstin: vendor?.gstin ?? "",
    payment_terms_days: vendor?.payment_terms_days != null ? String(vendor.payment_terms_days) : "",
    credit_period_days: vendor?.credit_period_days != null ? String(vendor.credit_period_days) : "",
    contact_person: vendor?.contact_person ?? "",
    phone: vendor?.phone ?? "",
    email: vendor?.email ?? "",
    bank_account_holder: vendor?.bank_account_holder ?? "",
    bank_account_number: vendor?.bank_account_number ?? "",
    bank_ifsc: vendor?.bank_ifsc ?? "",
    bank_name: vendor?.bank_name ?? "",
    upi_id: vendor?.upi_id ?? "",
    notes: vendor?.notes ?? "",
  };
}

function toPayload(form: VendorFormState): VendorPayload & { name: string } {
  return {
    name: form.name.trim(),
    gstin: form.gstin || null,
    payment_terms_days: form.payment_terms_days ? parseInt(form.payment_terms_days, 10) : null,
    credit_period_days: form.credit_period_days ? parseInt(form.credit_period_days, 10) : null,
    contact_person: form.contact_person || null,
    phone: form.phone || null,
    email: form.email || null,
    bank_account_holder: form.bank_account_holder || null,
    bank_account_number: form.bank_account_number || null,
    bank_ifsc: form.bank_ifsc || null,
    bank_name: form.bank_name || null,
    upi_id: form.upi_id || null,
    notes: form.notes || null,
  };
}

function apiErrorDetail(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
}

/** Create/edit vendor dialog. Pass `vendor` to edit in place; omit it (and
 * supply `trigger`) to create a new one. */
export function VendorFormDialog({
  vendor,
  trigger,
  onSaved,
}: {
  vendor?: VendorFull;
  trigger: React.ReactElement;
  onSaved?: (vendor: VendorFull) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<VendorFormState>(() => toFormState(vendor));

  const handleOpenChange = (next: boolean) => {
    if (next) setForm(toFormState(vendor));
    setOpen(next);
  };

  const mutation = useMutation({
    mutationFn: () => (vendor ? updateVendor(vendor.id, toPayload(form)) : createVendor(toPayload(form))),
    onSuccess: (saved) => {
      toast.success(vendor ? "Vendor updated" : "Vendor created");
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["vendors-full"] });
      if (vendor) queryClient.invalidateQueries({ queryKey: ["vendor", vendor.id] });
      setOpen(false);
      onSaved?.(saved);
    },
    onError: (e: unknown) => toast.error(apiErrorDetail(e, "Failed to save vendor")),
  });

  const field = (key: keyof VendorFormState, label: string, opts?: { type?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={opts?.type ?? "text"}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit vendor" : "Add vendor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-3">
            {field("name", "Vendor name")}
            {field("gstin", "GSTIN")}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payment terms</h4>
            <div className="grid grid-cols-2 gap-3">
              {field("payment_terms_days", "Payment terms (days)", { type: "number" })}
              {field("credit_period_days", "Credit period (days)", { type: "number" })}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Contact</h4>
            <div className="grid grid-cols-2 gap-3">
              {field("contact_person", "Contact person")}
              {field("phone", "Phone")}
            </div>
            <div className="mt-3">{field("email", "Email", { type: "email" })}</div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bank details</h4>
            <div className="grid grid-cols-2 gap-3">
              {field("bank_account_holder", "Account holder")}
              {field("bank_account_number", "Account number")}
              {field("bank_ifsc", "IFSC")}
              {field("bank_name", "Bank name")}
            </div>
            <div className="mt-3">{field("upi_id", "UPI ID")}</div>
          </div>

          {field("notes", "Notes")}

          {mutation.isError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {apiErrorDetail(mutation.error, "Failed to save vendor")}
            </div>
          )}

          <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name.trim()}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {vendor ? "Save changes" : "Create vendor"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
