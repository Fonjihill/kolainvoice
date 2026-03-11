use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Client {
    pub id: i64,
    pub name: String,
    pub niu: String,
    pub phone: String,
    pub email: String,
    pub address: String,
    pub notes: String,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveClientPayload {
    pub name: String,
    pub niu: String,
    pub phone: String,
    pub email: String,
    pub address: String,
    pub notes: String,
}
