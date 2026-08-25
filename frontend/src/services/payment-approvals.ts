import { apiClient } from '@/services/api-client';
import { ApprovalStatus, PaymentApproval } from '@/types/payment';

export async function listPaymentApprovals(status?: ApprovalStatus): Promise<PaymentApproval[]> {
  const res = await apiClient.get('/payment-approvals', { params: status ? { status } : {} });
  return res.data;
}

export async function approvePayment(id: string, notes?: string): Promise<PaymentApproval> {
  const res = await apiClient.post(`/payment-approvals/${id}/approve`, notes ? { notes } : {});
  return res.data;
}

export async function rejectPayment(id: string, notes?: string): Promise<PaymentApproval> {
  const res = await apiClient.post(`/payment-approvals/${id}/reject`, notes ? { notes } : {});
  return res.data;
}

export async function holdPayment(id: string, notes?: string): Promise<PaymentApproval> {
  const res = await apiClient.post(`/payment-approvals/${id}/hold`, notes ? { notes } : {});
  return res.data;
}
