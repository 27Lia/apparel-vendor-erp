export interface Tag {
  type: "color" | "category" | "style";
  value: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string | null;
  image_path: string;
  created_at: string;
  tags: Tag[];
}

export interface FilterOptions {
  brands: string[];
  color: string[];
  category: string[];
  style: string[];
}

export interface Buyer {
  id: number;
  name: string;
}

export type OrderStatus = "placed" | "in_production" | "shipped" | "completed" | "cancelled";

export interface OrderListItem {
  id: number;
  order_no: string;
  quantity: number;
  due_date: string | null;
  status: OrderStatus;
  order_date: string;
  buyer_name: string;
  style_name: string;
  style_image: string;
  produced_qty: number;
  shipment_status: string | null;
  invoice_paid: number | null;
}

export interface ProductionLog {
  id: number;
  order_id: number;
  factory: string;
  stage: "cutting" | "sewing" | "finishing";
  quantity_completed: number;
  log_date: string;
}

export interface Shipment {
  id: number;
  order_id: number;
  carrier: string | null;
  port: string | null;
  etd: string | null;
  eta: string | null;
  quantity: number;
  status: "booked" | "departed" | "arrived";
}

export interface Invoice {
  id: number;
  order_id: number;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string | null;
  paid: number;
}

export interface OrderDetail extends OrderListItem {
  buyer_id: number;
  style_id: number;
  production: ProductionLog[];
  shipments: Shipment[];
  invoices: Invoice[];
}

export interface Employee {
  id: number;
  name: string;
  department: string;
  position: string | null;
  hire_date: string | null;
}
