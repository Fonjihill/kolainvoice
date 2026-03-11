use tauri::State;

use crate::database;
use crate::models::quote::*;
use crate::AppState;

#[tauri::command]
pub fn get_all_quotes(
    state: State<AppState>,
    status_filter: Option<String>,
) -> Result<Vec<QuoteSummary>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::quotes::get_all_quotes(&conn, status_filter.as_deref())
}

#[tauri::command]
pub fn get_quote_by_id(state: State<AppState>, id: i64) -> Result<QuoteDetail, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::quotes::get_quote_detail(&conn, id)
}

#[tauri::command]
pub fn create_quote(
    state: State<AppState>,
    payload: CreateQuotePayload,
) -> Result<QuoteDetail, String> {
    let mut conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::quotes::create_quote(&mut conn, &payload)
}

#[tauri::command]
pub fn update_quote(
    state: State<AppState>,
    id: i64,
    payload: UpdateQuotePayload,
) -> Result<QuoteDetail, String> {
    let mut conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::quotes::update_quote(&mut conn, id, &payload)
}

#[tauri::command]
pub fn update_quote_status(
    state: State<AppState>,
    id: i64,
    status: String,
) -> Result<QuoteDetail, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::quotes::update_quote_status(&conn, id, &status)
}

#[tauri::command]
pub fn delete_quote(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::quotes::delete_quote(&conn, id)
}

#[tauri::command]
pub fn convert_quote_to_invoice(state: State<AppState>, id: i64) -> Result<i64, String> {
    let mut conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::quotes::convert_to_invoice(&mut conn, id)
}

#[tauri::command]
pub fn duplicate_quote(state: State<AppState>, id: i64) -> Result<QuoteDetail, String> {
    let mut conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::quotes::duplicate_quote(&mut conn, id)
}
