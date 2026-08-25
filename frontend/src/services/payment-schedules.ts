import { apiClient } from '@/services/api-client';
import { PaymentApproval, PaymentSchedule, PaymentScheduleStatus } from '@/types/payment';
import { BillSettlement, SettlementMethod } from '@/types/bill';

export interface PaymentScheduleCreatePayload {
  amount: number;
  scheduled_date: string;
  notes?: string | null;
}

export interface PaymentScheduleUpdatePayload {
  amount?: number;
  scheduled_date?: string;
  notes?: string | null;
}

export interface PaymentScheduleListFilters {
  status?: PaymentScheduleStatus;
  vendor_id?: string;
  bill_id?: string;
  date_from?: string;
  date_to?: string;
}

export async function createPaymentSchedule(billId: string, payload: PaymentScheduleCreatePayload): Promise<PaymentSchedule> {
  const res = await apiClient.post(`/bills/${billId}/payment-schedules`, payload);
  return res.data;
}

export async function listPaymentSchedules(filters: PaymentScheduleListFilters = {}): Promise<PaymentSchedule[]> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
  const res = await apiClient.get('/payment-schedules', { params });
  return res.data;
}

export async function updatePaymentSchedule(id: string, payload: PaymentScheduleUpdatePayload): Promise<PaymentSchedule> {
  const res = await apiClient.put(`/payment-schedules/${id}`, payload);
  return res.data;
}

export async function cancelPaymentSchedule(id: string): Promise<PaymentSchedule> {
  const res = await apiClient.delete(`/payment-schedules/${id}`);
  return res.data;
}

export async function submitForApproval(scheduleId: string): Promise<PaymentApproval> {
  const res = await apiClient.post(`/payment-schedules/${scheduleId}/submit-for-approval`);
  return res.data;
}

export interface PaymentCompletePayload {
  paid_on: string;
  method: SettlementMethod;
  reference?: string | null;
  notes?: string | null;
}

export async function completePaymentSchedule(scheduleId: string, payload: PaymentCompletePayload): Promise<BillSettlement> {
  const res = await apiClient.post(`/payment-schedules/${scheduleId}/complete`, payload);
  return res.data;
}
