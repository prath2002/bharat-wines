import { apiClient } from '@/services/api-client';
import {
  Bill,
  BillDetail,
  BillLimited,
  BillListFilters,
  BillListResponse,
  BillSettlement,
  ChargeItem,
  DueDateSource,
  FinanceSummary,
  SettlementMethod,
  Vendor,
} from '@/types/bill';

export async function uploadBill(file: File): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/bills/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function listBills(filters: BillListFilters = {}): Promise<BillListResponse> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const res = await apiClient.get('/bills', { params });
  return res.data;
}

export async function getBill(id: string): Promise<BillDetail | BillLimited> {
  const res = await apiClient.get(`/bills/${id}`);
  return res.data;
}

export interface BillUpdatePayload {
  bill_number?: string | null;
  bill_date?: string | null;
  vendor_id?: string | null;
  extracted_vendor_name?: string | null;
  subtotal?: number | null;
  discount_amount?: number;
  charges?: ChargeItem[];
  total_amount?: number | null;
  due_date?: string | null;
  due_date_source?: DueDateSource | null;
  notes?: string | null;
}

export async function updateBill(id: string, payload: BillUpdatePayload): Promise<Bill> {
  const res = await apiClient.put(`/bills/${id}`, payload);
  return res.data;
}

export async function verifyBill(id: string, vendorName?: string): Promise<Bill> {
  const res = await apiClient.post(`/bills/${id}/verify`, vendorName ? { vendor_name: vendorName } : {});
  return res.data;
}

export async function rejectBill(id: string): Promise<Bill> {
  const res = await apiClient.post(`/bills/${id}/reject`);
  return res.data;
}

export interface SettlementPayload {
  amount: number;
  paid_on: string;
  method: SettlementMethod;
  reference?: string;
  notes?: string;
}

export async function addSettlement(billId: string, payload: SettlementPayload): Promise<BillSettlement> {
  const res = await apiClient.post(`/bills/${billId}/settlements`, payload);
  return res.data;
}

export async function deleteSettlement(settlementId: string): Promise<void> {
  await apiClient.delete(`/bills/settlements/${settlementId}`);
}

export interface BillManualCreatePayload {
  bill_number?: string | null;
  bill_date?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  subtotal?: number | null;
  discount_amount?: number;
  charges?: ChargeItem[];
  total_amount: number;
  due_date?: string | null;
  due_date_source?: DueDateSource | null;
  notes?: string | null;
}

export async function createManualBill(payload: BillManualCreatePayload, file?: File | null): Promise<Bill> {
  const formData = new FormData();
  formData.append('payload', JSON.stringify(payload));
  if (file) formData.append('file', file);
  const res = await apiClient.post('/bills/manual', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export interface DueDateRecommendation {
  due_date: string | null;
  source: DueDateSource | null;
  payment_terms_days: number | null;
}

export async function getDueDateRecommendation(vendorId: string, billDate: string): Promise<DueDateRecommendation> {
  const res = await apiClient.get('/bills/due-date-recommendation', { params: { vendor_id: vendorId, bill_date: billDate } });
  return res.data;
}

export async function listVendors(): Promise<Vendor[]> {
  const res = await apiClient.get('/vendors');
  return res.data;
}

export async function getFinanceSummary(params: {
  date_from?: string;
  date_to?: string;
  vendor_id?: string;
} = {}): Promise<FinanceSummary> {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const res = await apiClient.get('/bills/summary', { params: cleaned });
  return res.data;
}
