import { apiClient } from '@/services/api-client';
import { VendorFull, VendorStatement } from '@/types/vendor';

export interface VendorPayload {
  name?: string;
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
}

export async function listVendorsFull(): Promise<VendorFull[]> {
  const res = await apiClient.get('/vendors');
  return res.data;
}

export async function createVendor(payload: VendorPayload & { name: string }): Promise<VendorFull> {
  const res = await apiClient.post('/vendors', payload);
  return res.data;
}

export async function getVendor(id: string): Promise<VendorFull> {
  const res = await apiClient.get(`/vendors/${id}`);
  return res.data;
}

export async function updateVendor(id: string, payload: VendorPayload): Promise<VendorFull> {
  const res = await apiClient.put(`/vendors/${id}`, payload);
  return res.data;
}

export async function getVendorStatement(id: string): Promise<VendorStatement> {
  const res = await apiClient.get(`/vendors/${id}/statement`);
  return res.data;
}
