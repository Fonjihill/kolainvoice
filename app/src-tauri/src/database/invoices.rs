use rusqlite::{params, Connection};

use crate::models::invoice::*;

// ── Amount calculations (all in Rust, integer FCFA) ─────

/// line_total = quantity * unit_price * (1 - discount/100), rounded to nearest integer
fn compute_line_total(quantity: f64, unit_price: i64, discount: f64) -> i64 {
    let raw = quantity * (unit_price as f64) * (1.0 - discount / 100.0);
    raw.round() as i64
}

/// Recalculate invoice totals from lines. Returns (subtotal, tva_amount, total).
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

// ── Atomic numbering ────────────────────────────

fn next_invoice_number(conn: &Connection, prefix: &str) -> Result<String, String> {
    let year = conn
        .query_row("SELECT strftime('%Y', 'now')", [], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| format!("Year query error: {e}"))?;

    let pattern = format!("{prefix}-{year}-%");
    let max_seq: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(SUBSTR(number, -4) AS INTEGER)), 0) FROM invoices WHERE number LIKE ?1",
            params![pattern],
            |row| row.get(0),
        )
        .map_err(|e| format!("Seq query error: {e}"))?;

    Ok(format!("{prefix}-{year}-{:04}", max_seq + 1))
}

// ── Read helpers ────────────────────────────────

fn get_lines(conn: &Connection, invoice_id: i64) -> Result<Vec<InvoiceLine>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_id, catalogue_id, description, quantity,
                    unit_price, discount, tva_rate, line_total, sort_order
             FROM invoice_lines WHERE invoice_id = ?1 ORDER BY sort_order",
        )
        .map_err(|e| format!("Prepare error: {e}"))?;

    let rows = stmt
        .query_map(params![invoice_id], |row| {
            Ok(InvoiceLine {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
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

pub fn get_invoice_detail(conn: &Connection, id: i64) -> Result<InvoiceDetail, String> {
    let detail = conn
        .query_row(
            "SELECT i.id, i.number, i.client_id, c.name, i.quote_id, q.number, i.status,
                    i.issue_date, i.due_date, i.notes, i.subtotal, i.tva_amount,
                    i.total, i.amount_paid, i.payment_method, i.payment_date,
                    i.created_at, i.updated_at
             FROM invoices i
             JOIN clients c ON i.client_id = c.id
             LEFT JOIN quotes q ON i.quote_id = q.id
             WHERE i.id = ?1",
            params![id],
            |row| {
                Ok(InvoiceDetail {
                    id: row.get(0)?,
                    number: row.get(1)?,
                    client_id: row.get(2)?,
                    client_name: row.get(3)?,
                    quote_id: row.get(4)?,
                    quote_number: row.get(5)?,
                    status: row.get(6)?,
                    issue_date: row.get(7)?,
                    due_date: row.get(8)?,
                    notes: row.get(9)?,
                    subtotal: row.get(10)?,
                    tva_amount: row.get(11)?,
                    total: row.get(12)?,
                    amount_paid: row.get(13)?,
                    payment_method: row.get(14)?,
                    payment_date: row.get(15)?,
                    lines: vec![],
                    created_at: row.get(16)?,
                    updated_at: row.get(17)?,
                })
            },
        )
        .map_err(|e| format!("Invoice not found: {e}"))?;

    let lines = get_lines(conn, id)?;
    Ok(InvoiceDetail { lines, ..detail })
}

// ── List ────────────────────────────────────────

pub fn get_all_invoices(
    conn: &Connection,
    status_filter: Option<&str>,
) -> Result<Vec<InvoiceSummary>, String> {
    let (where_clause, param): (&str, Option<String>) = match status_filter {
        Some(s) if !s.is_empty() => ("WHERE i.status = ?1", Some(s.to_string())),
        _ => ("", None),
    };

    let sql = format!(
        "SELECT i.id, i.number, i.client_id, c.name, i.status,
                i.issue_date, i.due_date, i.total, i.amount_paid, i.created_at
         FROM invoices i JOIN clients c ON i.client_id = c.id
         {where_clause}
         ORDER BY i.created_at DESC"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare error: {e}"))?;

    let mapper = |row: &rusqlite::Row| row_to_summary(row);

    let results: Vec<InvoiceSummary> = if let Some(ref p) = param {
        stmt.query_map(params![p], mapper)
    } else {
        stmt.query_map([], mapper)
    }
    .map_err(|e| format!("Query error: {e}"))?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| format!("Row error: {e}"))?;

    Ok(results)
}

fn row_to_summary(row: &rusqlite::Row) -> rusqlite::Result<InvoiceSummary> {
    Ok(InvoiceSummary {
        id: row.get(0)?,
        number: row.get(1)?,
        client_id: row.get(2)?,
        client_name: row.get(3)?,
        status: row.get(4)?,
        issue_date: row.get(5)?,
        due_date: row.get(6)?,
        total: row.get(7)?,
        amount_paid: row.get(8)?,
        created_at: row.get(9)?,
    })
}

// ── Create ──────────────────────────────────────

pub fn create_invoice(
    conn: &mut Connection,
    payload: &CreateInvoicePayload,
) -> Result<InvoiceDetail, String> {
    // Get prefix and payment_days from settings
    let (prefix, payment_days): (String, i64) = conn
        .query_row("SELECT invoice_prefix, payment_days FROM settings WHERE id = 1", [], |r| {
            Ok((r.get(0)?, r.get(1)?))
        })
        .map_err(|e| format!("Settings error: {e}"))?;

    let number = next_invoice_number(conn, &prefix)?;

    // Auto-calculate due_date if not provided
    let due_date = match &payload.due_date {
        Some(d) if !d.is_empty() => Some(d.clone()),
        _ => {
            let calculated: String = conn
                .query_row(
                    "SELECT date(?1, '+' || ?2 || ' days')",
                    params![payload.issue_date, payment_days],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Date calc error: {e}"))?;
            Some(calculated)
        }
    };

    let tx = conn.transaction().map_err(|e| format!("Transaction error: {e}"))?;

    let status = payload.status.as_deref().unwrap_or("draft");
    // Compute line totals and insert lines
    let mut line_data: Vec<(i64, f64)> = Vec::new();
    tx.execute(
        "INSERT INTO invoices (number, client_id, status, issue_date, due_date, payment_method, notes,
                               subtotal, tva_amount, total)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, 0)",
        params![number, payload.client_id, status, payload.issue_date, due_date, payload.payment_method, payload.notes],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    let invoice_id = tx.last_insert_rowid();

    for line in &payload.lines {
        let line_total = compute_line_total(line.quantity, line.unit_price, line.discount);
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
                line_total,
                line.sort_order,
            ],
        )
        .map_err(|e| format!("Line insert error: {e}"))?;
        line_data.push((line_total, line.tva_rate));
    }

    // Update totals
    let (subtotal, tva_amount, total) = compute_totals(&line_data);
    tx.execute(
        "UPDATE invoices SET subtotal = ?1, tva_amount = ?2, total = ?3 WHERE id = ?4",
        params![subtotal, tva_amount, total, invoice_id],
    )
    .map_err(|e| format!("Totals update error: {e}"))?;

    tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    get_invoice_detail(conn, invoice_id)
}

// ── Direct sale (invoice + payment in one shot) ─

pub fn create_direct_sale(
    conn: &mut Connection,
    payload: &DirectSalePayload,
) -> Result<InvoiceDetail, String> {
    let prefix: String = conn
        .query_row("SELECT invoice_prefix FROM settings WHERE id = 1", [], |r| r.get(0))
        .map_err(|e| format!("Settings error: {e}"))?;

    let number = next_invoice_number(conn, &prefix)?;

    let tx = conn.transaction().map_err(|e| format!("Transaction error: {e}"))?;

    let mut line_data: Vec<(i64, f64)> = Vec::new();
    tx.execute(
        "INSERT INTO invoices (number, client_id, status, issue_date, due_date, payment_method, notes,
                               subtotal, tva_amount, total, amount_paid)
         VALUES (?1, ?2, 'paid', ?3, NULL, ?4, ?5, 0, 0, 0, 0)",
        params![number, payload.client_id, payload.issue_date, payload.payment_method, payload.notes],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    let invoice_id = tx.last_insert_rowid();

    for line in &payload.lines {
        let line_total = compute_line_total(line.quantity, line.unit_price, line.discount);
        tx.execute(
            "INSERT INTO invoice_lines (invoice_id, catalogue_id, description, quantity,
                                        unit_price, discount, tva_rate, line_total, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                invoice_id, line.catalogue_id, line.description, line.quantity,
                line.unit_price, line.discount, line.tva_rate, line_total, line.sort_order,
            ],
        )
        .map_err(|e| format!("Line insert error: {e}"))?;
        line_data.push((line_total, line.tva_rate));
    }

    let (subtotal, tva_amount, total) = compute_totals(&line_data);
    tx.execute(
        "UPDATE invoices SET subtotal = ?1, tva_amount = ?2, total = ?3, amount_paid = ?3 WHERE id = ?4",
        params![subtotal, tva_amount, total, invoice_id],
    )
    .map_err(|e| format!("Totals update error: {e}"))?;

    let receipt_number = crate::database::payments::next_receipt_number(&tx)?;
    tx.execute(
        "INSERT INTO payments (invoice_id, number, amount, payment_method, payment_date, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, '')",
        params![invoice_id, receipt_number, total, payload.payment_method, payload.issue_date],
    )
    .map_err(|e| format!("Payment insert error: {e}"))?;

    tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    get_invoice_detail(conn, invoice_id)
}

// ── Update (draft only) ─────────────────────────

pub fn update_invoice(
    conn: &mut Connection,
    id: i64,
    payload: &UpdateInvoicePayload,
) -> Result<InvoiceDetail, String> {
    let tx = conn.transaction().map_err(|e| format!("Transaction error: {e}"))?;

    // Update invoice header (status + payment_method if provided)
    let new_status = payload.status.as_deref().unwrap_or("draft");
    tx.execute(
        "UPDATE invoices SET client_id = ?1, status = ?2, issue_date = ?3, due_date = ?4,
                payment_method = ?5, notes = ?6, updated_at = datetime('now')
         WHERE id = ?7",
        params![payload.client_id, new_status, payload.issue_date, payload.due_date, payload.payment_method, payload.notes, id],
    )
    .map_err(|e| format!("Update error: {e}"))?;

    // Replace all lines
    tx.execute("DELETE FROM invoice_lines WHERE invoice_id = ?1", params![id])
        .map_err(|e| format!("Delete lines error: {e}"))?;

    let mut line_data: Vec<(i64, f64)> = Vec::new();
    for line in &payload.lines {
        let line_total = compute_line_total(line.quantity, line.unit_price, line.discount);
        tx.execute(
            "INSERT INTO invoice_lines (invoice_id, catalogue_id, description, quantity,
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
        "UPDATE invoices SET subtotal = ?1, tva_amount = ?2, total = ?3 WHERE id = ?4",
        params![subtotal, tva_amount, total, id],
    )
    .map_err(|e| format!("Totals update error: {e}"))?;

    tx.commit().map_err(|e| format!("Commit error: {e}"))?;
    get_invoice_detail(conn, id)
}

// ── Status transitions ──────────────────────────

pub fn update_invoice_status(
    conn: &Connection,
    id: i64,
    new_status: &str,
) -> Result<InvoiceDetail, String> {
    let current: String = conn
        .query_row("SELECT status FROM invoices WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Invoice not found: {e}"))?;

    // Validate transitions — "paid" only via payment system, not manual
    let valid = match (current.as_str(), new_status) {
        ("draft", "sent") => true,
        ("draft", "cancelled") => true,
        ("sent", "cancelled") => true,
        _ => false,
    };

    if !valid {
        return Err(format!(
            "Transition invalide : {current} → {new_status}"
        ));
    }

    conn.execute(
        "UPDATE invoices SET status = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![new_status, id],
    )
    .map_err(|e| format!("Status update error: {e}"))?;

    get_invoice_detail(conn, id)
}

// ── Record payment ──────────────────────────────

pub fn record_payment(
    conn: &Connection,
    id: i64,
    payload: &RecordPaymentPayload,
) -> Result<InvoiceDetail, String> {
    let status: String = conn
        .query_row("SELECT status FROM invoices WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Invoice not found: {e}"))?;

    if status != "sent" {
        return Err("Le paiement ne peut être enregistré que sur une facture envoyée".to_string());
    }

    conn.execute(
        "UPDATE invoices SET status = 'paid', amount_paid = ?1, payment_method = ?2,
                payment_date = ?3, updated_at = datetime('now')
         WHERE id = ?4",
        params![payload.amount_paid, payload.payment_method, payload.payment_date, id],
    )
    .map_err(|e| format!("Payment error: {e}"))?;

    get_invoice_detail(conn, id)
}

// ── Delete (draft only) ─────────────────────────

pub fn delete_invoice(conn: &Connection, id: i64) -> Result<(), String> {
    let status: String = conn
        .query_row("SELECT status FROM invoices WHERE id = ?1", params![id], |r| {
            r.get(0)
        })
        .map_err(|e| format!("Invoice not found: {e}"))?;

    if status != "draft" {
        return Err("Seuls les brouillons peuvent être supprimés".to_string());
    }

    conn.execute("DELETE FROM invoice_lines WHERE invoice_id = ?1", params![id])
        .map_err(|e| format!("Delete lines error: {e}"))?;
    conn.execute("DELETE FROM invoices WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete error: {e}"))?;

    Ok(())
}
