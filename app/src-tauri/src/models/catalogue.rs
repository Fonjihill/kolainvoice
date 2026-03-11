use serde::{Deserialize, Serialize};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub color: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveCategoryPayload {
    pub name: String,
    pub description: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogueItem {
    pub id: i64,
    pub item_type: String, // "product" | "service"
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub name: String,
    pub description: String,
    pub unit_price: i64,
    pub unit: String,
    pub tva_applicable: bool,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveCataloguePayload {
    pub item_type: String,
    pub category_id: Option<i64>,
    pub name: String,
    pub description: String,
    pub unit_price: i64,
    pub unit: String,
    pub tva_applicable: bool,
}
