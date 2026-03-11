mod commands;
mod database;
mod license;
mod models;
mod pdf;

use std::sync::Mutex;
use tauri::Manager;

/// Application state shared across all IPC commands.
pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::db_status,
            commands::get_data_counts,
            commands::copy_image_to_app_data,
            commands::open_file,
            commands::export_database,
            commands::restore_database,
            commands::generate_document_pdf,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::clients::get_all_clients,
            commands::clients::get_client_by_id,
            commands::clients::create_client,
            commands::clients::update_client,
            commands::clients::archive_client,
            commands::clients::search_clients,
            commands::clients::get_system_client_id,
            commands::catalogue::get_categories,
            commands::catalogue::create_category,
            commands::catalogue::update_category,
            commands::catalogue::delete_category,
            commands::catalogue::get_catalogue,
            commands::catalogue::create_catalogue_item,
            commands::catalogue::update_catalogue_item,
            commands::catalogue::toggle_catalogue_item,
            commands::invoices::get_all_invoices,
            commands::invoices::get_invoice_by_id,
            commands::invoices::create_invoice,
            commands::invoices::update_invoice,
            commands::invoices::update_invoice_status,
            commands::invoices::record_payment,
            commands::invoices::create_direct_sale,
            commands::invoices::delete_invoice,
            commands::quotes::get_all_quotes,
            commands::quotes::get_quote_by_id,
            commands::quotes::create_quote,
            commands::quotes::update_quote,
            commands::quotes::update_quote_status,
            commands::quotes::delete_quote,
            commands::quotes::convert_quote_to_invoice,
            commands::quotes::duplicate_quote,
            commands::payments::get_payment_by_id,
            commands::payments::get_payments_for_invoice,
            commands::payments::create_payment,
            commands::payments::delete_payment,
            commands::license::get_license_status,
            commands::license::activate_license,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize database (backup + migrations)
            let conn = database::init(app.handle())
                .expect("Failed to initialize database");

            app.manage(AppState {
                db: Mutex::new(conn),
            });

            log::info!("Kola Invoice started successfully");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
