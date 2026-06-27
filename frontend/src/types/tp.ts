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

export interface TPReceipt {
  id: string;
  tp_number: string;
  supplier_name: string;
  tp_date: string;
  file_url: string;
  status: 'PROCESSING' | 'DRAFT' | 'APPROVED' | 'REJECTED';
  lines?: TPReceiptLine[];
}

export interface MRPChangeRequest {
  id: string;
  product_id: string;
  tp_receipt_id: string;
  old_mrp: number;
  new_mrp: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}
