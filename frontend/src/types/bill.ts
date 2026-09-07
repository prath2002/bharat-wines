export type BillStatus = 'PROCESSING' | 'DRAFT' | 'VERIFIED' | 'REJECTED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type SettlementMethod = 'BANK_TRANSFER' | 'UPI' | 'CASH' | 'CHEQUE' | 'OTHER';
export type DueDateSource = 'VENDOR_DEFAULT' | 'INVOICE' | 'MANUAL' | 'CONTRACT' | 'SYSTEM_CALCULATED';

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
  file_url?: string | null;
  bill_number?: string | null;
  bill_date?: string | null;
  subtotal?: number | null;
  discounts: ChargeItem[];
  charges?: ChargeItem[] | null;
  total_amount?: number | null;
  has_total_mismatch: boolean;
  status: BillStatus;
  payment_status: PaymentStatus;
  amount_paid: number;
  due_date?: string | null;
  due_date_source?: DueDateSource | null;
  notes?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface BillDetail extends Bill {
  ocr_raw_text?: string | null;
  extracted_data?: ({ total_amount?: number | null } & Record<string, unknown>) | null;
  settlements: BillSettlement[];
}

/** Restricted projection returned to STAFF (own uploads, no financial data). */
export interface BillLimited {
  id: string;
  file_url?: string | null;
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
  amount_min?: number;
  amount_max?: number;
  overdue?: boolean;
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
    payable: number;
    discounts: number;
    charges: number;
    bill_count: number;
    awaiting_review: number;
    due_today: number;
    due_this_week: number;
    due_this_month: number;
    scheduled_count: number;
    scheduled_amount: number;
    approval_pending_count: number;
    approval_pending_amount: number;
  };
  payment_breakdown: Record<PaymentStatus, { count: number; amount: number }>;
  aging: { "0-30": number; "31-60": number; "61-90": number; "90+": number };
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

export interface PendingBillItem {
  id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  bill_number: string | null;
  total_amount: number;
  outstanding: number;
  due_date: string | null;
  days_remaining: number | null;
  payment_status: PaymentStatus;
}

export interface OverdueBillItem {
  id: string;
  vendor_id: string | null;
  vendor_name: string | null;
  bill_number: string | null;
  total_amount: number;
  outstanding: number;
  due_date: string;
  days_overdue: number;
  payment_status: PaymentStatus;
}

export interface CalendarPaymentItem {
  payment_schedule_id: string;
  bill_id: string;
  vendor_name: string | null;
  bill_number: string | null;
  amount: number;
  status: string;
}

export interface CalendarDay {
  scheduled_date: string;
  total: number;
  items: CalendarPaymentItem[];
}

export interface PaymentHistoryItem {
  settlement_id: string;
  bill_id: string;
  bill_number: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  amount: number;
  paid_on: string;
  method: SettlementMethod;
  reference: string | null;
  approved_by: string | null;
}
