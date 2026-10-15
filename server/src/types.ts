export type TagType = "color" | "category" | "style";

export interface Tag {
  type: TagType;
  value: string;
  confidence: number;
}

export interface TaggingResult {
  name: string;
  brand: string | null;
  tags: Tag[];
}

export interface ProductRow {
  id: number;
  name: string;
  brand: string | null;
  image_path: string;
  created_at: string;
}

export type OrderStatus = "placed" | "in_production" | "shipped" | "completed" | "cancelled";
export type ProductionStage = "cutting" | "sewing" | "finishing";
export type ShipmentStatus = "booked" | "departed" | "arrived";

export interface BuyerRow {
  id: number;
  name: string;
}

export interface OrderRow {
  id: number;
  order_no: string;
  buyer_id: number;
  style_id: number;
  quantity: number;
  order_date: string;
  due_date: string | null;
  status: OrderStatus;
  created_at: string;
}

export interface ProductionLogRow {
  id: number;
  order_id: number;
  factory: string;
  stage: ProductionStage;
  quantity_completed: number;
  log_date: string;
}

export interface ShipmentRow {
  id: number;
  order_id: number;
  carrier: string | null;
  port: string | null;
  etd: string | null;
  eta: string | null;
  quantity: number;
  status: ShipmentStatus;
  created_at: string;
}

export interface InvoiceRow {
  id: number;
  order_id: number;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string | null;
  paid: number;
}

export interface EmployeeRow {
  id: number;
  name: string;
  department: string;
  position: string | null;
  hire_date: string | null;
}
