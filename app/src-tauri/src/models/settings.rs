use serde::{Deserialize, Serialize};

/// Full settings as stored in the database.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub id: i32,
    pub company_name: String,
    pub company_address: String,
    pub company_phone: String,
    pub company_email: String,
    pub company_niu: String,
    pub company_rccm: String,
    pub logo_path: Option<String>,
    pub stamp_path: Option<String>,
    pub tva_enabled: bool,
    pub tva_rate: f64,
    pub default_printer: Option<String>,
    pub language: String,
    pub invoice_prefix: String,
    pub quote_prefix: String,
    // Bank details
    pub bank_name: String,
    pub bank_account: String,
    pub bank_swift: String,
    // Numbering & defaults
    pub next_invoice_number: i64,
    pub next_quote_number: i64,
    pub payment_days: i64,
    pub quote_validity_days: i64,
    pub default_mentions: String,
    // Impression / PDF
    pub paper_format: String,
    pub default_copies: i64,
    pub pdf_include_logo: bool,
    pub pdf_include_stamp: bool,
    pub pdf_watermark_draft: bool,
    // Locale
    pub date_format: String,
    pub thousand_separator: String,
    // Backup & updates
    pub auto_backup_alert: bool,
    pub update_auto_check: bool,
    pub update_notify: bool,
}

/// Payload for updating settings.
#[derive(Debug, Deserialize)]
pub struct SaveSettingsPayload {
    pub company_name: String,
    pub company_address: String,
    pub company_phone: String,
    pub company_email: String,
    pub company_niu: String,
    pub company_rccm: String,
    pub logo_path: Option<String>,
    pub stamp_path: Option<String>,
    pub tva_enabled: bool,
    pub tva_rate: f64,
    pub default_printer: Option<String>,
    pub language: String,
    pub invoice_prefix: String,
    pub quote_prefix: String,
    // Bank details
    pub bank_name: String,
    pub bank_account: String,
    pub bank_swift: String,
    // Numbering & defaults
    pub next_invoice_number: i64,
    pub next_quote_number: i64,
    pub payment_days: i64,
    pub quote_validity_days: i64,
    pub default_mentions: String,
    // Impression / PDF
    pub paper_format: String,
    pub default_copies: i64,
    pub pdf_include_logo: bool,
    pub pdf_include_stamp: bool,
    pub pdf_watermark_draft: bool,
    // Locale
    pub date_format: String,
    pub thousand_separator: String,
    // Backup & updates
    pub auto_backup_alert: bool,
    pub update_auto_check: bool,
    pub update_notify: bool,
}
