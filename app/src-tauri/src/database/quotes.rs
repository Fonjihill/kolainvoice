use rusqlite::{params, Connection};

use crate::models::quote::*;

// ── Amount calculations (same as invoices) ───────

fn compute_line_total(quantity: f64, unit_price: i64, discount: f64) -> i64 {
    let raw = quantity * (unit_price as f64) * (1.0 - discount / 100.0);
    raw.round() as i64
}

fn compute_totals(lines: &[(i64, f64)]) -> (i64, i64, i64) {
    let mut subtotal: i64 = 0;
    let mut tva_amount: i64 = 0;
    for &(line_total, tva_rate) in lines {
        subtotal += line_total;
        tva_amount += (line_total as f64 * tva_rate / 100.0).round() as i64;
    }
    let total = subtotal + tva_amount;
    (subtotal, tva_amount, total)
}

// ── Numbering ────────────────────────────────────

fn next_quote_number(conn: &Connection, prefix: &str) -> Result<String, String> {
    let year = conn
        .query_row("SELECT strftime('%Y', 'now')", [], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| format!("Year query error: {e}"))?;

    let pattern = format!("{prefix}-{year}-%");
    let max_seq: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(SUBSTR(number, -4) AS INTEGER)), 0) FROM quotes WHERE number LIKE ?1",
            params![pattern],
            |row| row.get(0),
        )
        .map_err(|e| format!("Seq query error: {e}"))?;

    Ok(format!("{prefix}-{year}-{:04}", max_seq + 1))
}

// ── Read helpers ─────────────────────────────────

fn get_lines(conn: &Connection, quote_id: i64) -> Result<Vec<QuoteLine>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, quote_id, catalogue_id, description, quantity,
                    unit_price, discount, tva_rate, line_total, sort_order
             FROM quote_lines WHERE quote_id = ?1 ORDER BY sort_order",
        )
        .map_err(|e| format!("Prepare error: {e}"))?;

    let rows = stmt
        .query_map(params![quote_id], |row| {
            Ok(QuoteLine {
                id: row.get(0)?,
                quote_id: row.get(1)?,
                catalogue_id: row.get(2)?,
                description: row.get(3)?,
                quantity: row.get(4)?,
                unit_price: row.get(5)?,
                discount: row.get(6)?,
                tva_rate: row.get(7)?,
                line_total: row.get(8)?,
                sort_order: row.get(9)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row error: {e}"))
}

pub fn get_quote_detail(conn: &Connection, id: i64) -> Result<QuoteDetail, String> {
    let detail = conn
        .query_row(
            "SELECT q.id, q.number, q.client_id, c.name, q.object, q.status,
                    q.issue_date, q.validity_date, q.notes,
                    q.subtotal, q.tva_amount, q.total,
                    q.invoice_id, inv.number, q.created_at, q.updated_at
             FROM quotes q
             JOIN clients c ON q.client_id = c.id
             LEFT JOIN invoices inv ON q.invoice_id = inv.id
             WHERE q.id = ?1",
            params![id],
            |row| {
                Ok(QuoteDetail {
                    id: row.get(0)?,
                    number: row.get(1)?,
                    client_id: row.get(2)?,
                    client_name: row.get(3)?,
                    object: row.get(4)?,
                    status: row.get(5)?,
                    issue_date: row.get(6)?,
                    validity_date: row.get(7)?,
                    notes: row.get(8)?,
                    subtotal: row.get(9)?,
                    tva_amount: row.get(10)?,
                    total: row.get(11)?,
                    invoice_id: row.get(12)?,
                    invoice_number: row.get(13)?,
                    lines: vec![],
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                })
            },
        )
        .map_err(|e| format!("Quote not found: {e}"))?;

    let lines = get_lines(conn, id)?;
    Ok(QuoteDetail { lines, ..detail })
}

// ── List ─────────────────────────────────────────

pub fn get_all_quotes(
    conn: &Connection,
    status_filter: Option<&str>,
) -> Result<Vec<QuoteSummary>, String> {
    let (where_clause, param): (&str, Option<String>) = match status_filter {
        Some(s) if !s.is_empty() => ("WHERE q.status = ?1", Some(s.to_string())),
        _ => ("", None),
    };

    let sql = format!(
        "SELECT q.id, q.number, q.client_id, c.name, q.object, q.status,
                q.issue_date, q.validity_date, q.subtotal, q.tva_amount, q.total,
                q.notes, q.invoice_id, q.created_at
         FROM quotes q JOIN clients c ON q.client_id = c.id
         {where_clause}
         ORDER BY q.created_at DESC"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare error: {e}"))?;

    let mapper = |row: &rusqlite::Row| {
        Ok(QuoteSummary {
            id: row.get(0)?,
            number: row.get(1)?,
            client_id: row.get(2)?,
            client_name: row.get(3)?,
            object: row.get(4)?,
            status: row.get(5)?,
            issue_date: row.get(6)?,
            validity_date: row.get(7)?,
            subtotal: row.get(8)?,
            tva_amount: row.get(9)?,
            total: row.get(10)?,
            notes: row.get(11)?,
            invoice_id: row.get(12)?,
            created_at: row.get(13)?,
        })
    };

    let results: Vec<QuoteSummary> = if let Some(ref p) = param {
        stmt.query_map(params![p], mapper)
    } else {
        stmt.query_map([], mapper)
    }
    .map_err(|e| format!("Query error: {e}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Row error: {e}"))?;

    Ok(results)
}

// ── Create ───────────────────────────────────────

pub fn create_quote(
    conn: &mut Connection,
    payload: &CreateQuotePayload,
) -> Result<QuoteDetail, String> {
    let prefix: String = conn
        .query_row("SELECT quote_prefix FROM settings WHERE id = 1", [], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Settings error: {e}"))?;

    let number = next_quote_number(conn, &prefix)?;

    let tx = conn.transaction().map_err(|e| format!("Transaction error: {e}"))?;

    let mut line_data: Vec<(i64, f64)> = Vec::new();
    tx.execute(
        "INSERT INTO quotes (number, client_id, object, status, issue_date, validity_date, notes,
                             subtotal, tva_amount, total)
         VALUES (?1, ?2, ?3, 'draft', ?4, ?5, ?6, 0, 0, 0)",
        params![number, payload.client_id, payload.object, payload.issue_date, payload.validity_date, payload.notes],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    let quote_id = tx.last_insert_rowid();

    for line in &payload.lines {
        let line_total = compute_line_total(line.quantity, line.unit_price, line.discount);
        tx.execute(
            "INSERT INTO quote_lines (quote_id, catalogue_id, description, quantity,
                                      unit_price, discount, tva_rate, line_total, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                quote_id,
                line.catalogue_id,
                line.description,
                line.quantity,
                line.unit_price,
                line.discount,
                line.tva_rate,
                line_total,
                line.sort_order,
            ],
        )
        .map_err(|e| format!("Line insert error: {e}"))?;
        line_data.push((line_total, line.tva_rate));
    }

    let (subtotal, tva_amount, total) = compute_totals(&line_data);
    tx.execute(
        "UPDATE quotes SET subtotal = ?1, tva_amount = ?2, total = ?3 WHERE id = ?4",
        params![subtotal, tva_amount, total, quote_id],
    )
    .map_err(|e| format!("Totals update error: {e}"))?;

    tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    get_quote_detail(conn, quote_id)
}

// ── Update (draft only) ──────────────────────────

pub fn update_quote(
    conn: &mut Connection,
    id: i64,
    payload: &UpdateQuotePayload,
) -> Result<QuoteDetail, String> {
    let status: String = conn
        .query_row("SELECT status FROM quotes WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Quote not found: {e}"))?;

    if status != "draft" {
        return Err("Seuls les brouillons peuvent être modifiés".to_string());
    }

    let tx = conn.transaction().map_err(|e| format!("Transaction error: {e}"))?;

    tx.execute(
        "UPDATE quotes SET client_id = ?1, object = ?2, issue_date = ?3, validity_date = ?4,
                notes = ?5, updated_at = datetime('now')
         WHERE id = ?6",
        params![payload.client_id, payload.object, payload.issue_date, payload.validity_date, payload.notes, id],
    )
    .map_err(|e| format!("Update error: {e}"))?;

    tx.execute("DELETE FROM quote_lines WHERE quote_id = ?1", params![id])
        .map_err(|e| format!("Delete lines error: {e}"))?;

    let mut line_data: Vec<(i64, f64)> = Vec::new();
    for line in &payload.lines {
        let line_total = compute_line_total(line.quantity, line.unit_price, line.discount);
        tx.execute(
            "INSERT INTO quote_lines (quote_id, catalogue_id, description, quantity,
                                      unit_price, discount, tva_rate, line_total, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                line.catalogue_id,
                line.description,
                line.quantity,
                line.unit_price,
                line.discount,
                line.tva_rate,
                line_total,
                line.sort_order,
            ],
        )
        .map_err(|e| format!("Line insert error: {e}"))?;
        line_data.push((line_total, line.tva_rate));
    }

    let (subtotal, tva_amount, total) = compute_totals(&line_data);
    tx.execute(
        "UPDATE quotes SET subtotal = ?1, tva_amount = ?2, total = ?3 WHERE id = ?4",
        params![subtotal, tva_amount, total, id],
    )
    .map_err(|e| format!("Totals update error: {e}"))?;

    tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    get_quote_detail(conn, id)
}

// ── Status transitions ───────────────────────────

fn valid_transitions(current: &str) -> &'static [&'static str] {
    match current {
        "draft" => &["sent", "cancelled"],
        "sent" => &["accepted", "refused", "expired", "cancelled"],
        "accepted" => &["cancelled"],
        "refused" | "expired" | "cancelled" => &[],
        _ => &[],
    }
}

pub fn update_quote_status(
    conn: &Connection,
    id: i64,
    new_status: &str,
) -> Result<QuoteDetail, String> {
    let current_status: String = conn
        .query_row("SELECT status FROM quotes WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Quote not found: {e}"))?;

    let allowed = valid_transitions(&current_status);
    if !allowed.contains(&new_status) {
        return Err(format!(
            "Transition invalide : {} → {}",
            current_status, new_status
        ));
    }

    conn.execute(
        "UPDATE quotes SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_status, id],
    )
    .map_err(|e| format!("Status update error: {e}"))?;

    get_quote_detail(conn, id)
}

// ── Delete (draft only) ──────────────────────────

pub fn delete_quote(conn: &Connection, id: i64) -> Result<(), String> {
    let status: String = conn
        .query_row("SELECT status FROM quotes WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Quote not found: {e}"))?;

    if status != "draft" {
        return Err("Seuls les brouillons peuvent être supprimés".to_string());
    }

    conn.execute("DELETE FROM quote_lines WHERE quote_id = ?1", params![id])
        .map_err(|e| format!("Delete lines error: {e}"))?;
    conn.execute("DELETE FROM quotes WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete error: {e}"))?;

    Ok(())
}

// ── Duplicate quote ─────────────────────────────

pub fn duplicate_quote(conn: &mut Connection, id: i64) -> Result<QuoteDetail, String> {
    let source = get_quote_detail(conn, id)?;

    let prefix: String = conn
        .query_row("SELECT quote_prefix FROM settings WHERE id = 1", [], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Settings error: {e}"))?;

    let number = next_quote_number(conn, &prefix)?;

    let today: String = conn
        .query_row("SELECT date('now')", [], |row| row.get(0))
        .map_err(|e| format!("Date error: {e}"))?;

    let validity: String = conn
        .query_row("SELECT date('now', '+30 days')", [], |row| row.get(0))
        .map_err(|e| format!("Date error: {e}"))?;

    let tx = conn.transaction().map_err(|e| format!("Transaction error: {e}"))?;

    tx.execute(
        "INSERT INTO quotes (number, client_id, object, status, issue_date, validity_date, notes,
                             subtotal, tva_amount, total)
         VALUES (?1, ?2, ?3, 'draft', ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            number, source.client_id, source.object, today, validity,
            source.notes, source.subtotal, source.tva_amount, source.total
        ],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    let new_id = tx.last_insert_rowid();

    for line in &source.lines {
        tx.execute(
            "INSERT INTO quote_lines (quote_id, catalogue_id, description, quantity,
                                      unit_price, discount, tva_rate, line_total, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                new_id, line.catalogue_id, line.description, line.quantity,
                line.unit_price, line.discount, line.tva_rate, line.line_total, line.sort_order,
            ],
        )
        .map_err(|e| format!("Line copy error: {e}"))?;
    }

    tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    get_quote_detail(conn, new_id)
}

// ── Convert to invoice ───────────────────────────

pub fn convert_to_invoice(conn: &mut Connection, id: i64) -> Result<i64, String> {
    let quote = get_quote_detail(conn, id)?;

    if quote.status != "accepted" {
        return Err("Seuls les devis acceptés peuvent être convertis".to_string());
    }

    if quote.invoice_id.is_some() {
        return Err("Ce devis a déjà été converti en facture".to_string());
    }

    let prefix: String = conn
        .query_row("SELECT invoice_prefix FROM settings WHERE id = 1", [], |r| r.get(0))
        .map_err(|e| format!("Settings error: {e}"))?;

    let year = conn
        .query_row("SELECT strftime('%Y', 'now')", [], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Year query error: {e}"))?;

    let pattern = format!("{prefix}-{year}-%");
    let max_seq: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(SUBSTR(number, -4) AS INTEGER)), 0) FROM invoices WHERE number LIKE ?1",
            params![pattern],
            |row| row.get(0),
        )
        .map_err(|e| format!("Seq query error: {e}"))?;

    let inv_number = format!("{prefix}-{year}-{:04}", max_seq + 1);

    let tx = conn.transaction().map_err(|e| format!("Transaction error: {e}"))?;

    let today: String = tx
        .query_row("SELECT date('now')", [], |row| row.get(0))
        .map_err(|e| format!("Date error: {e}"))?;

    let due_date: String = tx
        .query_row("SELECT date('now', '+30 days')", [], |row| row.get(0))
        .map_err(|e| format!("Date error: {e}"))?;

    tx.execute(
        "INSERT INTO invoices (number, client_id, quote_id, status, issue_date, due_date, notes,
                               subtotal, tva_amount, total)
         VALUES (?1, ?2, ?3, 'draft', ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            inv_number, quote.client_id, id, today, due_date,
            format!("Issu du devis {}", quote.number),
            quote.subtotal, quote.tva_amount, quote.total
        ],
    )
    .map_err(|e| format!("Invoice insert error: {e}"))?;

    let invoice_id = tx.last_insert_rowid();

    for line in &quote.lines {
        tx.execute(
            "INSERT INTO invoice_lines (invoice_id, catalogue_id, description, quantity,
                                        unit_price, discount, tva_rate, line_total, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                invoice_id,
                line.catalogue_id,
                line.description,
                line.quantity,
                line.unit_price,
                line.discount,
                line.tva_rate,
                line.line_total,
                line.sort_order,
            ],
        )
        .map_err(|e| format!("Line copy error: {e}"))?;
    }

    // Link the quote back to the invoice
    tx.execute(
        "UPDATE quotes SET invoice_id = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![invoice_id, id],
    )
    .map_err(|e| format!("Quote link error: {e}"))?;

    tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    Ok(invoice_id)
}
