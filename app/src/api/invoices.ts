import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled";

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  catalogue_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tva_rate: number;
  line_total: number;
  sort_order: number;
}

export interface InvoiceLinePayload {
  catalogue_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tva_rate: number;
  sort_order: number;
}

export interface InvoiceSummary {
  id: number;
  number: string;
  client_id: number;
  client_name: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  created_at: string;
}

export interface InvoiceDetail {
  id: number;
  number: string;
  client_id: number;
  client_name: string;
  quote_id: number | null;
  quote_number: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  notes: string;
  subtotal: number;
  tva_amount: number;
  total: number;
  amount_paid: number;
  payment_method: string | null;
  payment_date: string | null;
  lines: InvoiceLine[];
  created_at: string;
  updated_at: string;
}

export interface CreateInvoicePayload {
  client_id: number;
  status?: string;
  issue_date: string;
  due_date: string | null;
  payment_method?: string;
  notes: string;
  lines: InvoiceLinePayload[];
}

export interface UpdateInvoicePayload {
  client_id: number;
  status?: string;
  issue_date: string;
  due_date: string | null;
  payment_method?: string;
  notes: string;
  lines: InvoiceLinePayload[];
}

export interface DirectSalePayload {
  client_id: number;
  issue_date: string;
  payment_method: string;
  notes: string;
  lines: InvoiceLinePayload[];
}

export interface RecordPaymentPayload {
  amount_paid: number;
  payment_method: string;
  payment_date: string;
}

// ── API calls ────────────────────────────────────

export async function getAllInvoices(
  statusFilter?: string,
): Promise<InvoiceSummary[]> {
  return invoke<InvoiceSummary[]>("get_all_invoices", {
    statusFilter: statusFilter ?? null,
  });
}

export async function getInvoiceById(id: number): Promise<InvoiceDetail> {
  return invoke<InvoiceDetail>("get_invoice_by_id", { id });
}

export async function createInvoice(
  payload: CreateInvoicePayload,
): Promise<InvoiceDetail> {
  return invoke<InvoiceDetail>("create_invoice", { payload });
}

export async function updateInvoice(
  id: number,
  payload: UpdateInvoicePayload,
): Promise<InvoiceDetail> {
  return invoke<InvoiceDetail>("update_invoice", { id, payload });
}

export async function updateInvoiceStatus(
  id: number,
  status: string,
): Promise<InvoiceDetail> {
  return invoke<InvoiceDetail>("update_invoice_status", { id, status });
}

export async function recordPayment(
  id: number,
  payload: RecordPaymentPayload,
): Promise<InvoiceDetail> {
  return invoke<InvoiceDetail>("record_payment", { id, payload });
}

export async function createDirectSale(
  payload: DirectSalePayload,
): Promise<InvoiceDetail> {
  return invoke<InvoiceDetail>("create_direct_sale", { payload });
}

export async function deleteInvoice(id: number): Promise<void> {
  return invoke<void>("delete_invoice", { id });
}
