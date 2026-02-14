
export type UserRole = 'admin' | 'manager' | 'stockist';

export interface Product {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  category_id?: string | null;
  min_stock?: number | null;
  user_id?: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  contact?: string | null;
  address?: string | null;
  whatsapp?: string | null;
  user_id?: string;
  created_at?: string;
}

export interface Client {
  id: string;
  name: string;
  cpf: string;
  birth_date?: string | null; // Format YYYY-MM-DD
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  user_id?: string;
  created_at?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  contact?: string | null;
  user_id?: string;
  created_at?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  password?: string; // Should be hashed in a real app
  organization_id?: string;
  avatar_url?: string | null;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  type: 'in' | 'out';
  quantity: number;
  date: string;
  reason?: string | null;
  employee_id?: string | null;
  employee_name?: string | null;
  receipt_photo?: string | null;
  work_order_id?: string | null;
  user_id?: string;
}

export interface NFeProduct {
  code: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export interface NFeSupplier {
  name: string;
  cnpj: string;
}

export interface ParsedNFe {
  supplier: NFeSupplier;
  products: NFeProduct[];
}

export interface NFe {
  id: string;
  supplier: NFeSupplier;
  products: NFeProduct[];
  total_value: number;
  import_date: string; // ISO string
  user_id?: string;
}

export interface PriceHistory {
  id: string;
  product_id: string;
  price: number;
  date: string;
  supplier_name?: string; // NOVO CAMPO
  user_id?: string;
}

export interface Asset {
  id:string;
  name: string;
  description: string;
  value: number;
  location: string;
  acquisition_date: string;
  photo?: string | null;
  user_id?: string;
  created_at?: string;
}

export interface MaintenanceRecord {
  id: string;
  asset_id: string;
  date: string;
  description: string;
  cost: number;
  type: 'completed' | 'scheduled';
  user_id?: string;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  user_id?: string;
  created_at?: string;
}

export interface AppNotification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  // Generic IDs for different notification types
  productId?: string;
  assetId?: string;
  maintenanceId?: string;
  user_id?: string;
}


export type ToastMessage = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
};

export interface CarPart {
  id: string; // Part number or custom ID
  name: string;
  description?: string | null;
  vehicle_model?: string | null;
  quantity: number;
  location?: string | null;
  photo?: string | null;
  unit_price: number;
  user_id?: string;
  created_at?: string;
}

export interface QuoteItem {
  id: string; // Unique ID for the item within the quote
  sourceId?: string; // ID of the product or car part, if it's from stock
  name: string;
  quantity: number;
  type: 'product' | 'carPart' | 'manual';
}

export interface Quote {
  id: string;
  title: string;
  created_at: string;
  items: QuoteItem[];
  user_id?: string;
}

export interface WorkOrder {
    id: string;
    title: string;
    status: 'open' | 'in_progress' | 'completed';
    created_at: string;
    items: QuoteItem[];
    user_id?: string;
}

export interface PurchaseOrderItem {
    product_id: string;
    product_name: string;
    quantity: number;
}

export interface PurchaseOrder {
    id: string;
    supplier_id: string;
    supplier_name: string;
    status: 'pending' | 'received';
    created_at: string;
    items: PurchaseOrderItem[];
    user_id?: string;
}

export interface ActivityLog {
    id: string;
    user: string;
    action: string;
    timestamp: string;
    user_id?: string;
}
