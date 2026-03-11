pub mod catalogue;
pub mod clients;
pub mod invoices;
pub mod license;
pub mod payments;
pub mod quotes;
pub mod settings;

use crate::AppState;
use tauri::{Manager, State};

/// Ping command — validates IPC communication between React and Rust.
#[tauri::command]
pub fn ping() -> String {
    "pong — Rust backend opérationnel 🌰".to_string()
}

/// Returns database status: schema version and table count.
#[tauri::command]
pub fn db_status(state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Query error: {e}"))?;

    let table_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Query error: {e}"))?;

    Ok(format!("DB v{version} — {table_count} tables"))
}

/// Returns row counts for main tables (used by Sauvegarde panel).
#[tauri::command]
pub fn get_data_counts(state: State<AppState>) -> Result<serde_json::Value, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let count = |table: &str| -> Result<i64, String> {
        conn.query_row(
            &format!("SELECT COUNT(*) FROM {table}"),
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Count error: {e}"))
    };
    Ok(serde_json::json!({
        "invoices": count("invoices")?,
        "quotes": count("quotes")?,
        "clients": count("clients")?,
        "catalogue": count("catalogue")?,
    }))
}

/// Copy an image file to the app data directory. Returns the new path.
#[tauri::command]
pub fn copy_image_to_app_data(
    app: tauri::AppHandle,
    source_path: String,
    target_name: String,
) -> Result<String, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("App data dir: {e}"))?;
    let images_dir = app_data.join("images");
    std::fs::create_dir_all(&images_dir)
        .map_err(|e| format!("Create images dir: {e}"))?;

    let source = std::path::Path::new(&source_path);
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png");
    let dest = images_dir.join(format!("{target_name}.{ext}"));

    std::fs::copy(&source, &dest)
        .map_err(|e| format!("Copy image: {e}"))?;

    Ok(dest.to_string_lossy().to_string())
}

/// Open a file with the system default application.
#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open file: {e}"))
}

/// Generate a PDF for an invoice or quote. Returns raw PDF bytes.
#[tauri::command]
pub fn generate_document_pdf(
    state: State<AppState>,
    doc_type: String,
    id: i64,
) -> Result<Vec<u8>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;

    let settings = crate::database::settings::get_settings(&conn)?;

    match doc_type.as_str() {
        "invoice" => {
            let invoice = crate::database::invoices::get_invoice_detail(&conn, id)?;
            let client = crate::database::clients::get_client_by_id(&conn, invoice.client_id)?;
            crate::pdf::generate_invoice_pdf(&settings, &client, &invoice)
        }
        "quote" => {
            let quote = crate::database::quotes::get_quote_detail(&conn, id)?;
            let client = crate::database::clients::get_client_by_id(&conn, quote.client_id)?;
            crate::pdf::generate_quote_pdf(&settings, &client, &quote)
        }
        "receipt" => {
            // id here is payment_id, not invoice_id
            let payment = conn.query_row(
                "SELECT id, invoice_id, number, amount, payment_method, payment_date, notes, created_at
                 FROM payments WHERE id = ?1",
                rusqlite::params![id],
                |row| Ok(crate::models::payment::Payment {
                    id: row.get(0)?,
                    invoice_id: row.get(1)?,
                    number: row.get(2)?,
                    amount: row.get(3)?,
                    payment_method: row.get(4)?,
                    payment_date: row.get(5)?,
                    notes: row.get(6)?,
                    created_at: row.get(7)?,
                }),
            ).map_err(|e| format!("Payment not found: {e}"))?;

            let invoice = crate::database::invoices::get_invoice_detail(&conn, payment.invoice_id)?;
            let client = crate::database::clients::get_client_by_id(&conn, invoice.client_id)?;

            let total_paid: i64 = conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = ?1",
                rusqlite::params![payment.invoice_id],
                |row| row.get(0),
            ).map_err(|e| format!("Sum error: {e}"))?;

            crate::pdf::generate_receipt_pdf(&settings, &client, &invoice, &payment, total_paid)
        }
        _ => Err(format!("Unknown document type: {doc_type}")),
    }
}
