export type PaymentScheduleStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'PAID'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'FAILED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ON_HOLD';

export interface PaymentSchedule {
  id: string;
  bill_id: string;
  vendor_name?: string | null;
  amount: number;
  scheduled_date: string;
  status: PaymentScheduleStatus;
  notes?: string | null;
  created_by: string;
  created_at: string;
}

export interface PaymentApproval {
  id: string;
  payment_schedule_id: string;
  status: ApprovalStatus;
  requested_by: string;
  decided_by?: string | null;
  decided_at?: string | null;
  notes?: string | null;
  approval_rule_id?: string | null;
  created_at: string;
}
