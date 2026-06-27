export enum MovementType {
  OPENING = 'OPENING',
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  RETURN = 'RETURN',
  DAMAGE = 'DAMAGE',
  ADJUSTMENT = 'ADJUSTMENT'
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: MovementType;
  quantity: number;
  batch_number?: string;
  reference_id?: string;
  reference_type?: string;
  created_by: string;
  notes?: string;
  created_at: string;
  product_name?: string;
  user_name?: string;
}
