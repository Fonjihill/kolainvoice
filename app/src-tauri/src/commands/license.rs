use tauri::State;
use crate::AppState;
use crate::license::manager;

#[tauri::command]
pub fn get_license_status(state: State<AppState>) -> Result<manager::LicenseStatus, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    manager::get_license_status(&conn)
}

#[tauri::command]
pub fn activate_license(state: State<AppState>, key: String) -> Result<manager::LicenseStatus, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    manager::activate_license(&conn, &key)
}
