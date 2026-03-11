import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────

export interface Payment {
  id: number;
  invoice_id: number;
  number: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string;
  created_at: string;
}

export interface CreatePaymentPayload {
  invoice_id: number;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string;
}

// ── API calls ────────────────────────────────────

export async function getPaymentsForInvoice(
  invoiceId: number,
): Promise<Payment[]> {
  return invoke<Payment[]>("get_payments_for_invoice", { invoiceId });
}

export async function createPayment(
  payload: CreatePaymentPayload,
): Promise<Payment> {
  return invoke<Payment>("create_payment", { payload });
}

export async function deletePayment(id: number): Promise<void> {
  return invoke<void>("delete_payment", { id });
}
