import { apiClient } from '@/services/api-client';
import { CalendarDay, OverdueBillItem, PaymentHistoryItem, PendingBillItem } from '@/types/bill';

export async function getPendingBills(vendorId?: string): Promise<PendingBillItem[]> {
  const res = await apiClient.get('/finance/pending-bills', { params: vendorId ? { vendor_id: vendorId } : {} });
  return res.data;
}

export async function getOverdueBills(vendorId?: string): Promise<OverdueBillItem[]> {
  const res = await apiClient.get('/finance/overdue-bills', { params: vendorId ? { vendor_id: vendorId } : {} });
  return res.data;
}

export async function getPaymentCalendar(params: {
  date_from?: string;
  date_to?: string;
  vendor_id?: string;
} = {}): Promise<CalendarDay[]> {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const res = await apiClient.get('/finance/payment-calendar', { params: cleaned });
  return res.data;
}

export async function getPaymentHistory(params: {
  date_from?: string;
  date_to?: string;
  vendor_id?: string;
} = {}): Promise<PaymentHistoryItem[]> {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const res = await apiClient.get('/finance/payment-history', { params: cleaned });
  return res.data;
}

export type ReportType =
  | 'pending-bills' | 'overdue-bills' | 'payment-history' | 'scheduled-payments' | 'vendor-wise' | 'monthly' | 'aging';

export async function downloadReport(
  reportType: ReportType,
  filename: string,
  params: { date_from?: string; date_to?: string; vendor_id?: string } = {}
): Promise<void> {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const res = await apiClient.get(`/finance/reports/${reportType}/export`, { params: cleaned, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
