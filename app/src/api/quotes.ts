import { invoke } from "@tauri-apps/api/core";

export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "expired" | "cancelled";

export interface QuoteLine {
  id: number;
  quote_id: number;
  catalogue_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tva_rate: number;
  line_total: number;
  sort_order: number;
}

export interface QuoteLinePayload {
  catalogue_id: number | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tva_rate: number;
  sort_order: number;
}

export interface QuoteSummary {
  id: number;
  number: string;
  client_id: number;
  client_name: string;
  object: string;
  status: QuoteStatus;
  issue_date: string;
  validity_date: string | null;
  subtotal: number;
  tva_amount: number;
  total: number;
  notes: string;
  invoice_id: number | null;
  created_at: string;
}

export interface QuoteDetail {
  id: number;
  number: string;
  client_id: number;
  client_name: string;
  object: string;
  status: QuoteStatus;
  issue_date: string;
  validity_date: string | null;
  notes: string;
  subtotal: number;
  tva_amount: number;
  total: number;
  invoice_id: number | null;
  invoice_number: string | null;
  lines: QuoteLine[];
  created_at: string;
  updated_at: string;
}

export interface CreateQuotePayload {
  client_id: number;
  object: string;
  issue_date: string;
  validity_date: string | null;
  notes: string;
  lines: QuoteLinePayload[];
}

export interface UpdateQuotePayload {
  client_id: number;
  object: string;
  issue_date: string;
  validity_date: string | null;
  notes: string;
  lines: QuoteLinePayload[];
}

export async function getAllQuotes(statusFilter?: string): Promise<QuoteSummary[]> {
  return invoke<QuoteSummary[]>("get_all_quotes", { statusFilter: statusFilter ?? null });
}

export async function getQuoteById(id: number): Promise<QuoteDetail> {
  return invoke<QuoteDetail>("get_quote_by_id", { id });
}

export async function createQuote(payload: CreateQuotePayload): Promise<QuoteDetail> {
  return invoke<QuoteDetail>("create_quote", { payload });
}

export async function updateQuote(id: number, payload: UpdateQuotePayload): Promise<QuoteDetail> {
  return invoke<QuoteDetail>("update_quote", { id, payload });
}

export async function updateQuoteStatus(id: number, status: string): Promise<QuoteDetail> {
  return invoke<QuoteDetail>("update_quote_status", { id, status });
}

export async function deleteQuote(id: number): Promise<void> {
  return invoke<void>("delete_quote", { id });
}

export async function convertQuoteToInvoice(id: number): Promise<number> {
  return invoke<number>("convert_quote_to_invoice", { id });
}

export async function duplicateQuote(id: number): Promise<QuoteDetail> {
  return invoke<QuoteDetail>("duplicate_quote", { id });
}
