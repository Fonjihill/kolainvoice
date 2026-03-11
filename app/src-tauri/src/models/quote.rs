use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteLine {
    pub id: i64,
    pub quote_id: i64,
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
pub struct QuoteLinePayload {
    pub catalogue_id: Option<i64>,
    pub description: String,
    pub quantity: f64,
    pub unit_price: i64,
    pub discount: f64,
    pub tva_rate: f64,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteSummary {
    pub id: i64,
    pub number: String,
    pub client_id: i64,
    pub client_name: String,
    pub object: String,
    pub status: String,
    pub issue_date: String,
    pub validity_date: Option<String>,
    pub subtotal: i64,
    pub tva_amount: i64,
    pub total: i64,
    pub notes: String,
    pub invoice_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteDetail {
    pub id: i64,
    pub number: String,
    pub client_id: i64,
    pub client_name: String,
    pub object: String,
    pub status: String,
    pub issue_date: String,
    pub validity_date: Option<String>,
    pub notes: String,
    pub subtotal: i64,
    pub tva_amount: i64,
    pub total: i64,
    pub invoice_id: Option<i64>,
    pub invoice_number: Option<String>,
    pub lines: Vec<QuoteLine>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuotePayload {
    pub client_id: i64,
    pub object: String,
    pub issue_date: String,
    pub validity_date: Option<String>,
    pub notes: String,
    pub lines: Vec<QuoteLinePayload>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateQuotePayload {
    pub client_id: i64,
    pub object: String,
    pub issue_date: String,
    pub validity_date: Option<String>,
    pub notes: String,
    pub lines: Vec<QuoteLinePayload>,
}
