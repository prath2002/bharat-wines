export enum Role {
  ADMIN = 'ADMIN',
  STOCK_MANAGER = 'STOCK_MANAGER',
  STAFF = 'STAFF',
  FINANCE = 'FINANCE'
}

export interface User {
  id: string;
  business_id: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}
