use rusqlite::{params, Connection};

use crate::models::catalogue::{CatalogueItem, Category, SaveCataloguePayload, SaveCategoryPayload};

// ── Categories ──────────────────────────────────────────

fn row_to_category(row: &rusqlite::Row) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        color: row.get(3)?,
        created_at: row.get(4)?,
    })
}

pub fn get_categories(conn: &Connection) -> Result<Vec<Category>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, description, color, created_at FROM categories ORDER BY name COLLATE NOCASE")
        .map_err(|e| format!("Prepare error: {e}"))?;

    let rows = stmt
        .query_map([], |row| row_to_category(row))
        .map_err(|e| format!("Query error: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row error: {e}"))
}

pub fn create_category(conn: &Connection, payload: &SaveCategoryPayload) -> Result<Category, String> {
    conn.execute(
        "INSERT INTO categories (name, description, color) VALUES (?1, ?2, ?3)",
        params![payload.name, payload.description, payload.color],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, description, color, created_at FROM categories WHERE id = ?1",
        params![id],
        |row| row_to_category(row),
    )
    .map_err(|e| format!("Read error: {e}"))
}

pub fn update_category(conn: &Connection, id: i64, payload: &SaveCategoryPayload) -> Result<Category, String> {
    let changed = conn
        .execute(
            "UPDATE categories SET name = ?1, description = ?2, color = ?3 WHERE id = ?4",
            params![payload.name, payload.description, payload.color, id],
        )
        .map_err(|e| format!("Update error: {e}"))?;

    if changed == 0 {
        return Err("Category not found".to_string());
    }
    conn.query_row(
        "SELECT id, name, description, color, created_at FROM categories WHERE id = ?1",
        params![id],
        |row| row_to_category(row),
    )
    .map_err(|e| format!("Read error: {e}"))
}

pub fn delete_category(conn: &Connection, id: i64) -> Result<(), String> {
    // Detach catalogue items from this category
    conn.execute(
        "UPDATE catalogue SET category_id = NULL WHERE category_id = ?1",
        params![id],
    )
    .map_err(|e| format!("Detach error: {e}"))?;

    let changed = conn
        .execute("DELETE FROM categories WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete error: {e}"))?;

    if changed == 0 {
        return Err("Category not found".to_string());
    }
    Ok(())
}

// ── Catalogue items ─────────────────────────────────────

const SELECT_COLS: &str =
    "c.id, c.item_type, c.category_id, cat.name, c.name, c.description,
     c.unit_price, c.unit, c.tva_applicable, c.active, c.created_at, c.updated_at";

const FROM_CLAUSE: &str = "catalogue c LEFT JOIN categories cat ON c.category_id = cat.id";

fn row_to_item(row: &rusqlite::Row) -> rusqlite::Result<CatalogueItem> {
    Ok(CatalogueItem {
        id: row.get(0)?,
        item_type: row.get(1)?,
        category_id: row.get(2)?,
        category_name: row.get(3)?,
        name: row.get(4)?,
        description: row.get(5)?,
        unit_price: row.get(6)?,
        unit: row.get(7)?,
        tva_applicable: row.get::<_, i32>(8)? != 0,
        active: row.get::<_, i32>(9)? != 0,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn get_catalogue(conn: &Connection, active_only: bool) -> Result<Vec<CatalogueItem>, String> {
    let where_clause = if active_only { "WHERE c.active = 1" } else { "" };
    let sql = format!(
        "SELECT {SELECT_COLS} FROM {FROM_CLAUSE} {where_clause} ORDER BY c.item_type, c.name COLLATE NOCASE"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare error: {e}"))?;
    let rows = stmt
        .query_map([], |row| row_to_item(row))
        .map_err(|e| format!("Query error: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row error: {e}"))
}

pub fn get_catalogue_item(conn: &Connection, id: i64) -> Result<CatalogueItem, String> {
    conn.query_row(
        &format!("SELECT {SELECT_COLS} FROM {FROM_CLAUSE} WHERE c.id = ?1"),
        params![id],
        |row| row_to_item(row),
    )
    .map_err(|e| format!("Item not found: {e}"))
}

pub fn create_catalogue_item(
    conn: &Connection,
    payload: &SaveCataloguePayload,
) -> Result<CatalogueItem, String> {
    conn.execute(
        "INSERT INTO catalogue (item_type, category_id, name, description, unit_price, unit, tva_applicable)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            payload.item_type,
            payload.category_id,
            payload.name,
            payload.description,
            payload.unit_price,
            payload.unit,
            payload.tva_applicable as i32,
        ],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    get_catalogue_item(conn, conn.last_insert_rowid())
}

pub fn update_catalogue_item(
    conn: &Connection,
    id: i64,
    payload: &SaveCataloguePayload,
) -> Result<CatalogueItem, String> {
    let changed = conn
        .execute(
            "UPDATE catalogue SET item_type = ?1, category_id = ?2, name = ?3, description = ?4,
                 unit_price = ?5, unit = ?6, tva_applicable = ?7, updated_at = datetime('now')
             WHERE id = ?8",
            params![
                payload.item_type,
                payload.category_id,
                payload.name,
                payload.description,
                payload.unit_price,
                payload.unit,
                payload.tva_applicable as i32,
                id,
            ],
        )
        .map_err(|e| format!("Update error: {e}"))?;

    if changed == 0 {
        return Err("Item not found".to_string());
    }
    get_catalogue_item(conn, id)
}

pub fn toggle_catalogue_item(conn: &Connection, id: i64) -> Result<CatalogueItem, String> {
    let changed = conn
        .execute(
            "UPDATE catalogue SET active = NOT active, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| format!("Toggle error: {e}"))?;

    if changed == 0 {
        return Err("Item not found".to_string());
    }
    get_catalogue_item(conn, id)
}
