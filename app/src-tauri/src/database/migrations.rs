use rusqlite::Connection;

/// All migrations in order. Each tuple: (version, name, SQL content).
/// SQL is embedded at compile time so it ships inside the binary.
const MIGRATIONS: &[(i32, &str, &str)] = &[
    (1, "001_init", include_str!("sql/001_init.sql")),
    (2, "002_category_desc_color", include_str!("sql/002_category_desc_color.sql")),
    (3, "003_settings_fields", include_str!("sql/003_settings_fields.sql")),
    (4, "004_quote_object", include_str!("sql/004_quote_object.sql")),
    (5, "005_relax_payment_method", include_str!("sql/005_relax_payment_method.sql")),
    (6, "006_settings_updates", include_str!("sql/006_settings_updates.sql")),
    (7, "007_quote_invoice_link", include_str!("sql/007_quote_invoice_link.sql")),
    (8, "008_payments", include_str!("sql/008_payments.sql")),
    (9, "009_client_anonyme", include_str!("sql/009_client_anonyme.sql")),
    (10, "010_license", include_str!("sql/010_license.sql")),
];

/// Returns the current schema version (0 if no migrations have run yet).
fn current_version(conn: &Connection) -> Result<i32, String> {
    // Create the schema_version table if it doesn't exist
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version    INTEGER PRIMARY KEY,
            name       TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        );"
    )
    .map_err(|e| format!("Failed to create schema_version table: {e}"))?;

    let version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_version",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to read schema version: {e}"))?;

    Ok(version)
}

/// Run all pending migrations inside a transaction.
pub fn run_migrations(conn: &mut Connection) -> Result<(), String> {
    let current = current_version(conn)?;

    let pending: Vec<_> = MIGRATIONS
        .iter()
        .filter(|(v, _, _)| *v > current)
        .collect();

    if pending.is_empty() {
        log::info!("Database is up to date (version {current})");
        return Ok(());
    }

    log::info!(
        "Running {} migration(s) from version {current} to {}",
        pending.len(),
        pending.last().map(|(v, _, _)| *v).unwrap_or(current)
    );

    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {e}"))?;

    for (version, name, sql) in &pending {
        log::info!("Applying migration {name} (v{version})...");

        tx.execute_batch(sql)
            .map_err(|e| format!("Migration {name} failed: {e}"))?;

        tx.execute(
            "INSERT INTO schema_version (version, name) VALUES (?1, ?2)",
            rusqlite::params![version, name],
        )
        .map_err(|e| format!("Failed to record migration {name}: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit migrations: {e}"))?;

    log::info!("All migrations applied successfully");
    Ok(())
}
