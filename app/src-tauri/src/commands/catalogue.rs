use tauri::State;

use crate::database;
use crate::models::catalogue::{CatalogueItem, Category, SaveCataloguePayload, SaveCategoryPayload};
use crate::AppState;

#[tauri::command]
pub fn get_categories(state: State<AppState>) -> Result<Vec<Category>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::catalogue::get_categories(&conn)
}

#[tauri::command]
pub fn create_category(state: State<AppState>, payload: SaveCategoryPayload) -> Result<Category, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::catalogue::create_category(&conn, &payload)
}

#[tauri::command]
pub fn update_category(state: State<AppState>, id: i64, payload: SaveCategoryPayload) -> Result<Category, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::catalogue::update_category(&conn, id, &payload)
}

#[tauri::command]
pub fn delete_category(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::catalogue::delete_category(&conn, id)
}

#[tauri::command]
pub fn get_catalogue(
    state: State<AppState>,
    active_only: bool,
) -> Result<Vec<CatalogueItem>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::catalogue::get_catalogue(&conn, active_only)
}

#[tauri::command]
pub fn create_catalogue_item(
    state: State<AppState>,
    payload: SaveCataloguePayload,
) -> Result<CatalogueItem, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::catalogue::create_catalogue_item(&conn, &payload)
}

#[tauri::command]
pub fn update_catalogue_item(
    state: State<AppState>,
    id: i64,
    payload: SaveCataloguePayload,
) -> Result<CatalogueItem, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::catalogue::update_catalogue_item(&conn, id, &payload)
}

#[tauri::command]
pub fn toggle_catalogue_item(
    state: State<AppState>,
    id: i64,
) -> Result<CatalogueItem, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::catalogue::toggle_catalogue_item(&conn, id)
}
