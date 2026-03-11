use serde::{Deserialize, Serialize};

// ── Statuses & Payment ──────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    Draft,
    Sent,
    Paid,
    Cancelled,
}

impl InvoiceStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Sent => "sent",
            Self::Paid => "paid",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "draft" => Ok(Self::Draft),
            "sent" => Ok(Self::Sent),
            "paid" => Ok(Self::Paid),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(format!("Invalid invoice status: {s}")),
        }
    }
}

// ── Invoice line ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceLine {
    pub id: i64,
    pub invoice_id: i64,
    pub catalogue_id: Option<i64>,
    pub description: String,
    pub quantity: f64,
    pub unit_price: i64,
    pub discount: f64,
    pub tva_rate: f64,
    pub line_total: i64,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InvoiceLinePayload {
    pub catalogue_id: Option<i64>,
    pub description: String,
    pub quantity: f64,
    pub unit_price: i64,
    pub discount: f64,
    pub tva_rate: f64,
    pub sort_order: i32,
}

// ── Invoice summary (list view) ─────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceSummary {
    pub id: i64,
    pub number: String,
    pub client_id: i64,
    pub client_name: String,
    pub status: String,
    pub issue_date: String,
    pub due_date: Option<String>,
    pub total: i64,
    pub amount_paid: i64,
    pub created_at: String,
}

// ── Invoice detail (full view with lines) ───────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceDetail {
    pub id: i64,
    pub number: String,
    pub client_id: i64,
    pub client_name: String,
    pub quote_id: Option<i64>,
    pub quote_number: Option<String>,
    pub status: String,
    pub issue_date: String,
    pub due_date: Option<String>,
    pub notes: String,
    pub subtotal: i64,
    pub tva_amount: i64,
    pub total: i64,
    pub amount_paid: i64,
    pub payment_method: Option<String>,
    pub payment_date: Option<String>,
    pub lines: Vec<InvoiceLine>,
    pub created_at: String,
    pub updated_at: String,
}

// ── Create/Update payloads ──────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateInvoicePayload {
    pub client_id: i64,
    pub status: Option<String>,
    pub issue_date: String,
    pub due_date: Option<String>,
    pub payment_method: Option<String>,
    pub notes: String,
    pub lines: Vec<InvoiceLinePayload>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInvoicePayload {
    pub client_id: i64,
    pub status: Option<String>,
    pub issue_date: String,
    pub due_date: Option<String>,
    pub payment_method: Option<String>,
    pub notes: String,
    pub lines: Vec<InvoiceLinePayload>,
}

#[derive(Debug, Deserialize)]
pub struct RecordPaymentPayload {
    pub amount_paid: i64,
    pub payment_method: String,
    pub payment_date: String,
}

#[derive(Debug, Deserialize)]
pub struct DirectSalePayload {
    pub client_id: i64,
    pub issue_date: String,
    pub payment_method: String,
    pub notes: String,
    pub lines: Vec<InvoiceLinePayload>,
}
