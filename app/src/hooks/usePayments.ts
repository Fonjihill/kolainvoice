import { create } from "zustand";
import {
  getPaymentsForInvoice,
  createPayment,
  deletePayment,
  type Payment,
  type CreatePaymentPayload,
} from "../api/payments";

interface PaymentsStore {
  payments: Payment[];
  loading: boolean;
  error: string | null;

  fetch: (invoiceId: number) => Promise<void>;
  add: (payload: CreatePaymentPayload) => Promise<Payment>;
  remove: (id: number, invoiceId: number) => Promise<void>;
}

export const usePayments = create<PaymentsStore>((set, get) => ({
  payments: [],
  loading: false,
  error: null,

  fetch: async (invoiceId) => {
    set({ loading: true, error: null });
    try {
      const payments = await getPaymentsForInvoice(invoiceId);
      set({ payments, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  add: async (payload) => {
    const payment = await createPayment(payload);
    await get().fetch(payload.invoice_id);
    return payment;
  },

  remove: async (id, invoiceId) => {
    await deletePayment(id);
    await get().fetch(invoiceId);
  },
}));
