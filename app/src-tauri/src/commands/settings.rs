use tauri::State;

use crate::database;
use crate::models::settings::{SaveSettingsPayload, Settings};
use crate::AppState;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<Settings, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::settings::get_settings(&conn)
}

#[tauri::command]
pub fn save_settings(
    state: State<AppState>,
    payload: SaveSettingsPayload,
) -> Result<Settings, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::settings::save_settings(&conn, &payload)
}
