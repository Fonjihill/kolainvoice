import { create } from "zustand";
import {
  getAllQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  convertQuoteToInvoice,
  duplicateQuote,
  type QuoteSummary,
  type QuoteDetail,
  type CreateQuotePayload,
  type UpdateQuotePayload,
} from "../api/quotes";

interface QuotesStore {
  quotes: QuoteSummary[];
  loading: boolean;
  error: string | null;
  statusFilter: string;

  fetch: () => Promise<void>;
  setStatusFilter: (status: string) => void;
  getById: (id: number) => Promise<QuoteDetail>;
  create: (payload: CreateQuotePayload) => Promise<QuoteDetail>;
  update: (id: number, payload: UpdateQuotePayload) => Promise<QuoteDetail>;
  changeStatus: (id: number, status: string) => Promise<QuoteDetail>;
  remove: (id: number) => Promise<void>;
  convert: (id: number) => Promise<number>;
  duplicate: (id: number) => Promise<QuoteDetail>;
}

export const useQuotes = create<QuotesStore>((set, get) => ({
  quotes: [],
  loading: false,
  error: null,
  statusFilter: "",

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const filter = get().statusFilter || undefined;
      const quotes = await getAllQuotes(filter);
      set({ quotes, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status });
    get().fetch();
  },

  getById: async (id) => {
    return getQuoteById(id);
  },

  create: async (payload) => {
    const detail = await createQuote(payload);
    await get().fetch();
    return detail;
  },

  update: async (id, payload) => {
    const detail = await updateQuote(id, payload);
    await get().fetch();
    return detail;
  },

  changeStatus: async (id, status) => {
    const detail = await updateQuoteStatus(id, status);
    await get().fetch();
    return detail;
  },

  remove: async (id) => {
    await deleteQuote(id);
    await get().fetch();
  },

  convert: async (id) => {
    const invoiceId = await convertQuoteToInvoice(id);
    await get().fetch();
    return invoiceId;
  },

  duplicate: async (id) => {
    const detail = await duplicateQuote(id);
    await get().fetch();
    return detail;
  },
}));
