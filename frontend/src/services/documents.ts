import { apiClient } from '@/services/api-client';

export type DocumentType = 'INVOICE' | 'PURCHASE_ORDER' | 'PAYMENT_PROOF' | 'RECEIPT' | 'SUPPORTING';

export interface FinanceDocument {
  id: string;
  owner_type: 'BILL' | 'PAYMENT';
  owner_id: string;
  doc_type: DocumentType;
  file_url: string;
  uploaded_by: string;
  created_at: string;
}

async function uploadDocument(path: string, docType: DocumentType, file: File): Promise<FinanceDocument> {
  const formData = new FormData();
  formData.append('doc_type', docType);
  formData.append('file', file);
  const res = await apiClient.post(path, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return res.data;
}

export const uploadBillDocument = (billId: string, docType: DocumentType, file: File) =>
  uploadDocument(`/bills/${billId}/documents`, docType, file);

export async function listBillDocuments(billId: string): Promise<FinanceDocument[]> {
  const res = await apiClient.get(`/bills/${billId}/documents`);
  return res.data;
}

export const uploadPaymentDocument = (paymentId: string, docType: DocumentType, file: File) =>
  uploadDocument(`/payments/${paymentId}/documents`, docType, file);

export async function listPaymentDocuments(paymentId: string): Promise<FinanceDocument[]> {
  const res = await apiClient.get(`/payments/${paymentId}/documents`);
  return res.data;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/documents/${documentId}`);
}
