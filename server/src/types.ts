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
