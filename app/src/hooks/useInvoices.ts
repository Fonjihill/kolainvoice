import { create } from "zustand";
import {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  recordPayment,
  deleteInvoice,
  type InvoiceSummary,
  type InvoiceDetail,
  type CreateInvoicePayload,
  type UpdateInvoicePayload,
  type RecordPaymentPayload,
  type DirectSalePayload,
  createDirectSale,
} from "../api/invoices";

interface InvoicesStore {
  invoices: InvoiceSummary[];
  loading: boolean;
  error: string | null;
  statusFilter: string;

  fetch: () => Promise<void>;
  setStatusFilter: (status: string) => void;
  getById: (id: number) => Promise<InvoiceDetail>;
  create: (payload: CreateInvoicePayload) => Promise<InvoiceDetail>;
  update: (id: number, payload: UpdateInvoicePayload) => Promise<InvoiceDetail>;
  changeStatus: (id: number, status: string) => Promise<InvoiceDetail>;
  pay: (id: number, payload: RecordPaymentPayload) => Promise<InvoiceDetail>;
  directSale: (payload: DirectSalePayload) => Promise<InvoiceDetail>;
  remove: (id: number) => Promise<void>;
}

export const useInvoices = create<InvoicesStore>((set, get) => ({
  invoices: [],
  loading: false,
  error: null,
  statusFilter: "",

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const filter = get().statusFilter || undefined;
      const invoices = await getAllInvoices(filter);
      set({ invoices, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status });
    get().fetch();
  },

  getById: async (id) => {
    return getInvoiceById(id);
  },

  create: async (payload) => {
    const detail = await createInvoice(payload);
    await get().fetch();
    return detail;
  },

  update: async (id, payload) => {
    const detail = await updateInvoice(id, payload);
    await get().fetch();
    return detail;
  },

  changeStatus: async (id, status) => {
    const detail = await updateInvoiceStatus(id, status);
    await get().fetch();
    return detail;
  },

  pay: async (id, payload) => {
    const detail = await recordPayment(id, payload);
    await get().fetch();
    return detail;
  },

  directSale: async (payload) => {
    const detail = await createDirectSale(payload);
    await get().fetch();
    return detail;
  },

  remove: async (id) => {
    await deleteInvoice(id);
    await get().fetch();
  },
}));
