export interface TPReceiptLine {
  id: string;
  product_id?: string;
  extracted_name: string;
  extracted_size: string | null;
  quantity_bottles: number;
  total_bottles: number;
  extracted_mrp: number;
  batch_number: string;
  match_confidence: number;
  is_matched: boolean;
}

export type TPStatus = 'PROCESSING' | 'DRAFT' | 'APPROVED' | 'REJECTED';

export interface TPReceipt {
  id: string;
  tp_number: string;
  supplier_name: string;
  tp_date: string;
  file_url: string;
  status: TPStatus;
  lines?: TPReceiptLine[];
}

export interface TPReceiptSummary {
  id: string;
  tp_number: string | null;
  supplier_name: string | null;
  tp_date: string | null;
  status: TPStatus;
  created_at: string;
}

export interface TPListFilters {
  status?: TPStatus;
  supplier_name?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface TPReceiptListResponse {
  items: TPReceiptSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface MRPChangeRequest {
  id: string;
  product_id: string;
  tp_receipt_id: string;
  old_mrp: number;
  new_mrp: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}
