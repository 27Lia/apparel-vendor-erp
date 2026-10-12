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
