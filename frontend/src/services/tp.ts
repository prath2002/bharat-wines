import { apiClient } from '@/services/api-client';
import { TPListFilters, TPReceiptListResponse } from '@/types/tp';

export async function listTPReceipts(filters: TPListFilters = {}): Promise<TPReceiptListResponse> {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const res = await apiClient.get('/tp/receipts', { params });
  return res.data;
}

export async function listTPSuppliers(): Promise<string[]> {
  const res = await apiClient.get('/tp/receipts/suppliers');
  return res.data;
}
