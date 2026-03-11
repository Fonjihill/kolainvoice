pub mod catalogue;
pub mod clients;
pub mod invoices;
pub mod migrations;
pub mod payments;
pub mod quotes;
pub mod settings;

use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::Manager;

const DB_FILENAME: &str = "kola-invoice.db";

/// Resolve the database file path inside the platform app data directory.
fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot resolve app data dir: {e}"))?;

    fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create app data dir: {e}"))?;

    Ok(dir.join(DB_FILENAME))
}

/// Create a timestamped backup of the database file (before migrations).
fn backup_database(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(()); // Nothing to back up
    }

    let secs = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let timestamp = secs;
    let backup_name = format!(
        "{}.backup_{timestamp}",
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(DB_FILENAME)
    );
    let backup_path = path.with_file_name(backup_name);

    fs::copy(path, &backup_path)
        .map_err(|e| format!("Backup failed: {e}"))?;

    log::info!("Database backed up to {}", backup_path.display());
    Ok(())
}

/// Initialize the database: open/create the file, back up, run migrations.
pub fn init(app: &tauri::AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;

    log::info!("Database path: {}", path.display());

    // Back up before any migration
    backup_database(&path)?;

    let mut conn = Connection::open(&path)
        .map_err(|e| format!("Cannot open database: {e}"))?;

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {e}"))?;

    // Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {e}"))?;

    migrations::run_migrations(&mut conn)?;

    Ok(conn)
}
