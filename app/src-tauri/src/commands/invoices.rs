use tauri::State;

use crate::database;
use crate::models::invoice::*;
use crate::AppState;

#[tauri::command]
pub fn get_all_invoices(
    state: State<AppState>,
    status_filter: Option<String>,
) -> Result<Vec<InvoiceSummary>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::get_all_invoices(&conn, status_filter.as_deref())
}

#[tauri::command]
pub fn get_invoice_by_id(state: State<AppState>, id: i64) -> Result<InvoiceDetail, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::get_invoice_detail(&conn, id)
}

#[tauri::command]
pub fn create_invoice(
    state: State<AppState>,
    payload: CreateInvoicePayload,
) -> Result<InvoiceDetail, String> {
    let mut conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::create_invoice(&mut conn, &payload)
}

#[tauri::command]
pub fn update_invoice(
    state: State<AppState>,
    id: i64,
    payload: UpdateInvoicePayload,
) -> Result<InvoiceDetail, String> {
    let mut conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::update_invoice(&mut conn, id, &payload)
}

#[tauri::command]
pub fn update_invoice_status(
    state: State<AppState>,
    id: i64,
    status: String,
) -> Result<InvoiceDetail, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::update_invoice_status(&conn, id, &status)
}

#[tauri::command]
pub fn record_payment(
    state: State<AppState>,
    id: i64,
    payload: RecordPaymentPayload,
) -> Result<InvoiceDetail, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::record_payment(&conn, id, &payload)
}

#[tauri::command]
pub fn create_direct_sale(
    state: State<AppState>,
    payload: DirectSalePayload,
) -> Result<InvoiceDetail, String> {
    let mut conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::create_direct_sale(&mut conn, &payload)
}

#[tauri::command]
pub fn delete_invoice(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    database::invoices::delete_invoice(&conn, id)
}
