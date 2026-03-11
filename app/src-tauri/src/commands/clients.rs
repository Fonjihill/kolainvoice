use tauri::State;

use crate::database;
use crate::models::client::{Client, SaveClientPayload};
use crate::AppState;

#[tauri::command]
pub fn get_all_clients(state: State<AppState>, archived: bool) -> Result<Vec<Client>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::clients::get_all_clients(&conn, archived)
}

#[tauri::command]
pub fn get_client_by_id(state: State<AppState>, id: i64) -> Result<Client, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::clients::get_client_by_id(&conn, id)
}

#[tauri::command]
pub fn create_client(state: State<AppState>, payload: SaveClientPayload) -> Result<Client, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::clients::create_client(&conn, &payload)
}

#[tauri::command]
pub fn update_client(
    state: State<AppState>,
    id: i64,
    payload: SaveClientPayload,
) -> Result<Client, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::clients::update_client(&conn, id, &payload)
}

#[tauri::command]
pub fn archive_client(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::clients::archive_client(&conn, id)
}

#[tauri::command]
pub fn search_clients(state: State<AppState>, query: String) -> Result<Vec<Client>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::clients::search_clients(&conn, &query)
}

#[tauri::command]
pub fn get_system_client_id(state: State<AppState>) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::clients::get_system_client_id(&conn)
}
