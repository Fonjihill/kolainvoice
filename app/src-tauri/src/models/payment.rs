use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: i64,
    pub invoice_id: i64,
    pub number: String,
    pub amount: i64,
    pub payment_method: String,
    pub payment_date: String,
    pub notes: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentPayload {
    pub invoice_id: i64,
    pub amount: i64,
    pub payment_method: String,
    pub payment_date: String,
    pub notes: String,
}
