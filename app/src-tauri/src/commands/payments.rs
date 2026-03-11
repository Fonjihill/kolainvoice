use tauri::State;

use crate::database;
use crate::models::payment::*;
use crate::AppState;

#[tauri::command]
pub fn get_payment_by_id(state: State<AppState>, id: i64) -> Result<Payment, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::payments::get_payment_by_id(&conn, id)
}

#[tauri::command]
pub fn get_payments_for_invoice(
    state: State<AppState>,
    invoice_id: i64,
) -> Result<Vec<Payment>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::payments::get_payments_for_invoice(&conn, invoice_id)
}

#[tauri::command]
pub fn create_payment(
    state: State<AppState>,
    payload: CreatePaymentPayload,
) -> Result<Payment, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::payments::create_payment(&conn, &payload)
}

#[tauri::command]
pub fn delete_payment(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::payments::delete_payment(&conn, id)
}
