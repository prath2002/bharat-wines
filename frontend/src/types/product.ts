export enum ProductCategory {
  IMFL = 'IMFL',
  MML = 'MML',
  CL = 'CL',
  WINE = 'WINE',
  BEER = 'BEER'
}

export interface Barcode {
  id: string;
  product_id: string;
  barcode_value: string;
  barcode_format: string;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  size_ml: number;
  mrp: number;
  purchase_price: number;
  scm_code: string;
  additional_scm_codes?: string[];
  case_size?: number;
  status: 'ACTIVE' | 'INACTIVE';
  current_stock?: number;
  barcodes?: Barcode[];
}
