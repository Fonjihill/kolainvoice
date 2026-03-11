import { create } from "zustand";
import {
  getCatalogue,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createCatalogueItem,
  updateCatalogueItem,
  toggleCatalogueItem,
  type CatalogueItem,
  type Category,
  type SaveCataloguePayload,
  type SaveCategoryPayload,
} from "../api/catalogue";

interface CatalogueStore {
  items: CatalogueItem[];
  categories: Category[];
  loading: boolean;
  error: string | null;
  activeOnly: boolean;

  fetch: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  setActiveOnly: (v: boolean) => void;
  create: (payload: SaveCataloguePayload) => Promise<CatalogueItem>;
  update: (id: number, payload: SaveCataloguePayload) => Promise<CatalogueItem>;
  toggle: (id: number) => Promise<void>;
  addCategory: (payload: SaveCategoryPayload) => Promise<Category>;
  editCategory: (id: number, payload: SaveCategoryPayload) => Promise<Category>;
  removeCategory: (id: number) => Promise<void>;
}

export const useCatalogue = create<CatalogueStore>((set, get) => ({
  items: [],
  categories: [],
  loading: false,
  error: null,
  activeOnly: true,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const items = await getCatalogue(get().activeOnly);
      set({ items, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const categories = await getCategories();
      set({ categories });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  setActiveOnly: (v) => {
    set({ activeOnly: v });
    get().fetch();
  },

  create: async (payload) => {
    set({ loading: true, error: null });
    try {
      const item = await createCatalogueItem(payload);
      await get().fetch();
      return item;
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
  },

  update: async (id, payload) => {
    set({ loading: true, error: null });
    try {
      const item = await updateCatalogueItem(id, payload);
      await get().fetch();
      return item;
    } catch (e) {
      set({ error: String(e), loading: false });
      throw e;
    }
  },

  toggle: async (id) => {
    set({ error: null });
    try {
      await toggleCatalogueItem(id);
      await get().fetch();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  addCategory: async (payload) => {
    try {
      const cat = await createCategory(payload);
      await get().fetchCategories();
      return cat;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  editCategory: async (id, payload) => {
    try {
      const cat = await updateCategory(id, payload);
      await get().fetchCategories();
      return cat;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  removeCategory: async (id) => {
    try {
      await deleteCategory(id);
      await get().fetchCategories();
      await get().fetch();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
