import { invoke } from "@tauri-apps/api/core";

export interface Settings {
  id: number;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_niu: string;
  company_rccm: string;
  logo_path: string | null;
  stamp_path: string | null;
  tva_enabled: boolean;
  tva_rate: number;
  default_printer: string | null;
  language: string;
  invoice_prefix: string;
  quote_prefix: string;
  // Bank details
  bank_name: string;
  bank_account: string;
  bank_swift: string;
  // Numbering & defaults
  next_invoice_number: number;
  next_quote_number: number;
  payment_days: number;
  quote_validity_days: number;
  default_mentions: string;
  // Impression / PDF
  paper_format: string;
  default_copies: number;
  pdf_include_logo: boolean;
  pdf_include_stamp: boolean;
  pdf_watermark_draft: boolean;
  // Locale
  date_format: string;
  thousand_separator: string;
  // Backup & updates
  auto_backup_alert: boolean;
  update_auto_check: boolean;
  update_notify: boolean;
}

export type SaveSettingsPayload = Omit<Settings, "id">;

export async function getSettings(): Promise<Settings> {
  return invoke<Settings>("get_settings");
}

export async function saveSettings(
  payload: SaveSettingsPayload,
): Promise<Settings> {
  return invoke<Settings>("save_settings", { payload });
}

export interface DataCounts {
  invoices: number;
  quotes: number;
  clients: number;
  catalogue: number;
}

export async function getDataCounts(): Promise<DataCounts> {
  return invoke<DataCounts>("get_data_counts");
}

export async function exportDatabase(destination: string): Promise<void> {
  return invoke<void>("export_database", { destination });
}

export async function restoreDatabase(source: string): Promise<void> {
  return invoke<void>("restore_database", { source });
}
