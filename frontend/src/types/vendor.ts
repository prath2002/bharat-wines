import { SettlementMethod } from '@/types/bill';

/** Full vendor projection (terms, bank details, contact) — used on the
 * vendor list/detail pages. The lean `Vendor` shape in types/bill.ts stays
 * as-is for dropdowns elsewhere. */
export interface VendorFull {
  id: string;
  name: string;
  gstin?: string | null;
  payment_terms_days?: number | null;
  credit_period_days?: number | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_account_holder?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  upi_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface VendorUpcomingPayment {
  payment_schedule_id: string;
  bill_id: string;
  bill_number?: string | null;
  amount: number;
  scheduled_date: string;
  status: string;
}

export interface VendorPaymentHistoryItem {
  bill_id: string;
  bill_number?: string | null;
  settlement_id: string;
  amount: number;
  paid_on: string;
  method: SettlementMethod;
  reference?: string | null;
}

export interface VendorStatement {
  vendor_id: string;
  vendor_name: string;
  total_bills: number;
  total_billed: number;
  total_paid: number;
  outstanding_amount: number;
  overdue_amount: number;
  upcoming_payments: VendorUpcomingPayment[];
  payment_history: VendorPaymentHistoryItem[];
}
