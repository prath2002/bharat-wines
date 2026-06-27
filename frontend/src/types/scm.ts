export interface SCMRecord {
  id?: string;
  scm_code: string;
  product_name: string;
  category: string;
  size_ml: number;
  opening: number;
  purchases: number;
  sales: number;
  returns: number;
  damage: number;
  closing: number;
  date?: string;
}

export interface SCMResponse {
  date: string;
  records: SCMRecord[];
  totals: any;
}
