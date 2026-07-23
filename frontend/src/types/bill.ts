export type BillStatus = 'PROCESSING' | 'DRAFT' | 'VERIFIED' | 'REJECTED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type SettlementMethod = 'BANK_TRANSFER' | 'UPI' | 'CASH' | 'CHEQUE' | 'OTHER';

export interface ChargeItem {
  label: string;
  amount: number;
}

export interface Vendor {
  id: string;
  name: string;
  gstin?: string | null;
  created_at: string;
}

export interface BillSettlement {
  id: string;
  bill_id: string;
  amount: number;
  paid_on: string;
  method: SettlementMethod;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
}

/** Full projection returned to FINANCE / ADMIN. */
export interface Bill {
  id: string;
  vendor_id?: string | null;
  vendor_name?: string | null;
  extracted_vendor_name?: string | null;
  uploaded_by: string;
  file_url: string;
  bill_number?: string | null;
  bill_date?: string | null;
  subtotal?: number | null;
  discount_amount: number;
  charges?: ChargeItem[] | null;
  total_amount?: number | null;
  has_total_mismatch: boolean;
  status: BillStatus;
  payment_status: PaymentStatus;
  amount_paid: number;
  due_date?: string | null;
  notes?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface BillDetail extends Bill {
  ocr_raw_text?: string | null;
  settlements: BillSettlement[];
}

/** Restricted projection returned to STAFF (own uploads, no financial data). */
export interface BillLimited {
  id: string;
  file_url: string;
  status: BillStatus;
  created_at: string;
}

export interface BillListResponse<T = Bill | BillLimited> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface BillListFilters {
  status?: BillStatus;
  payment_status?: PaymentStatus;
  vendor_id?: string;
  uploaded_by?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface FinanceSummary {
  totals: {
    billed: number;
    paid: number;
    outstanding: number;
    discounts: number;
    charges: number;
    bill_count: number;
    awaiting_review: number;
  };
  payment_breakdown: Record<PaymentStatus, { count: number; amount: number }>;
  monthly: { month: string; billed: number; paid: number }[];
  vendors: {
    vendor_id: string | null;
    name: string;
    billed: number;
    paid: number;
    outstanding: number;
    bill_count: number;
    last_bill_date: string | null;
    oldest_unpaid_days: number;
  }[];
  attention: {
    drafts: {
      id: string;
      extracted_vendor_name: string | null;
      total_amount: number;
      has_total_mismatch: boolean;
      created_at: string;
    }[];
    overdue: {
      id: string;
      vendor_name: string;
      total_amount: number;
      outstanding: number;
      due_date: string;
      days_overdue: number;
    }[];
  };
}
