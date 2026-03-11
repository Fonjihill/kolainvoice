import { invoke } from "@tauri-apps/api/core";

export interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  created_at: string;
}

export interface SaveCategoryPayload {
  name: string;
  description: string;
  color: string;
}

export interface CatalogueItem {
  id: number;
  item_type: "product" | "service";
  category_id: number | null;
  category_name: string | null;
  name: string;
  description: string;
  unit_price: number;
  unit: string;
  tva_applicable: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SaveCataloguePayload {
  item_type: "product" | "service";
  category_id: number | null;
  name: string;
  description: string;
  unit_price: number;
  unit: string;
  tva_applicable: boolean;
}

export async function getCategories(): Promise<Category[]> {
  return invoke<Category[]>("get_categories");
}

export async function createCategory(payload: SaveCategoryPayload): Promise<Category> {
  return invoke<Category>("create_category", { payload });
}

export async function updateCategory(id: number, payload: SaveCategoryPayload): Promise<Category> {
  return invoke<Category>("update_category", { id, payload });
}

export async function deleteCategory(id: number): Promise<void> {
  return invoke<void>("delete_category", { id });
}

export async function getCatalogue(activeOnly = true): Promise<CatalogueItem[]> {
  return invoke<CatalogueItem[]>("get_catalogue", { activeOnly });
}

export async function createCatalogueItem(
  payload: SaveCataloguePayload,
): Promise<CatalogueItem> {
  return invoke<CatalogueItem>("create_catalogue_item", { payload });
}

export async function updateCatalogueItem(
  id: number,
  payload: SaveCataloguePayload,
): Promise<CatalogueItem> {
  return invoke<CatalogueItem>("update_catalogue_item", { id, payload });
}

export async function toggleCatalogueItem(id: number): Promise<CatalogueItem> {
  return invoke<CatalogueItem>("toggle_catalogue_item", { id });
}
