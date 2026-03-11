use rusqlite::{params, Connection};

use crate::models::client::{Client, SaveClientPayload};

fn row_to_client(row: &rusqlite::Row) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get(0)?,
        name: row.get(1)?,
        niu: row.get(2)?,
        phone: row.get(3)?,
        email: row.get(4)?,
        address: row.get(5)?,
        notes: row.get(6)?,
        archived: row.get::<_, i32>(7)? != 0,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

const SELECT_COLS: &str =
    "id, name, niu, phone, email, address, notes, archived, created_at, updated_at";

pub fn get_all_clients(conn: &Connection, archived: bool) -> Result<Vec<Client>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {SELECT_COLS} FROM clients WHERE archived = ?1 AND is_system = 0 ORDER BY name COLLATE NOCASE"
        ))
        .map_err(|e| format!("Prepare error: {e}"))?;

    let rows = stmt
        .query_map(params![archived as i32], |row| row_to_client(row))
        .map_err(|e| format!("Query error: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row error: {e}"))
}

pub fn get_client_by_id(conn: &Connection, id: i64) -> Result<Client, String> {
    conn.query_row(
        &format!("SELECT {SELECT_COLS} FROM clients WHERE id = ?1"),
        params![id],
        |row| row_to_client(row),
    )
    .map_err(|e| format!("Client not found: {e}"))
}

pub fn create_client(conn: &Connection, payload: &SaveClientPayload) -> Result<Client, String> {
    conn.execute(
        "INSERT INTO clients (name, niu, phone, email, address, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            payload.name,
            payload.niu,
            payload.phone,
            payload.email,
            payload.address,
            payload.notes,
        ],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    let id = conn.last_insert_rowid();
    get_client_by_id(conn, id)
}

pub fn update_client(
    conn: &Connection,
    id: i64,
    payload: &SaveClientPayload,
) -> Result<Client, String> {
    let is_system: i32 = conn
        .query_row("SELECT COALESCE(is_system, 0) FROM clients WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| format!("Client not found: {e}"))?;
    if is_system == 1 {
        return Err("Le client systeme ne peut pas etre modifie".to_string());
    }

    let changed = conn
        .execute(
            "UPDATE clients SET name = ?1, niu = ?2, phone = ?3, email = ?4,
                 address = ?5, notes = ?6, updated_at = datetime('now')
             WHERE id = ?7",
            params![
                payload.name,
                payload.niu,
                payload.phone,
                payload.email,
                payload.address,
                payload.notes,
                id,
            ],
        )
        .map_err(|e| format!("Update error: {e}"))?;

    if changed == 0 {
        return Err("Client not found".to_string());
    }
    get_client_by_id(conn, id)
}

pub fn archive_client(conn: &Connection, id: i64) -> Result<(), String> {
    let is_system: i32 = conn
        .query_row("SELECT COALESCE(is_system, 0) FROM clients WHERE id = ?1", params![id], |r| r.get(0))
        .map_err(|e| format!("Client not found: {e}"))?;
    if is_system == 1 {
        return Err("Le client systeme ne peut pas etre modifie".to_string());
    }

    let changed = conn
        .execute(
            "UPDATE clients SET archived = 1, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| format!("Archive error: {e}"))?;

    if changed == 0 {
        return Err("Client not found".to_string());
    }
    Ok(())
}

pub fn search_clients(conn: &Connection, query: &str) -> Result<Vec<Client>, String> {
    let pattern = format!("%{query}%");
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {SELECT_COLS} FROM clients
             WHERE archived = 0 AND is_system = 0
               AND (name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1 OR niu LIKE ?1)
             ORDER BY name COLLATE NOCASE
             LIMIT 50"
        ))
        .map_err(|e| format!("Prepare error: {e}"))?;

    let rows = stmt
        .query_map(params![pattern], |row| row_to_client(row))
        .map_err(|e| format!("Query error: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row error: {e}"))
}

pub fn get_system_client_id(conn: &Connection) -> Result<i64, String> {
    conn.query_row(
        "SELECT id FROM clients WHERE is_system = 1 LIMIT 1",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("System client not found: {e}"))
}
