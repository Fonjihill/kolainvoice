use rusqlite::{params, Connection};

use crate::models::payment::*;

fn next_receipt_number(conn: &Connection) -> Result<String, String> {
    let year = conn
        .query_row("SELECT strftime('%Y', 'now')", [], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| format!("Year query error: {e}"))?;

    let pattern = format!("REC-{year}-%");
    let max_seq: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(SUBSTR(number, -4) AS INTEGER)), 0) FROM payments WHERE number LIKE ?1",
            params![pattern],
            |row| row.get(0),
        )
        .map_err(|e| format!("Seq query error: {e}"))?;

    Ok(format!("REC-{year}-{:04}", max_seq + 1))
}

fn recalc_amount_paid(conn: &Connection, invoice_id: i64) -> Result<i64, String> {
    let total_paid: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = ?1",
            params![invoice_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Sum error: {e}"))?;

    conn.execute(
        "UPDATE invoices SET amount_paid = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![total_paid, invoice_id],
    )
    .map_err(|e| format!("Update amount_paid error: {e}"))?;

    // Auto-transition to "paid" if total reached
    let (status, total): (String, i64) = conn
        .query_row(
            "SELECT status, total FROM invoices WHERE id = ?1",
            params![invoice_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Invoice query error: {e}"))?;

    if status == "sent" && total_paid >= total {
        conn.execute(
            "UPDATE invoices SET status = 'paid', updated_at = datetime('now') WHERE id = ?1",
            params![invoice_id],
        )
        .map_err(|e| format!("Status update error: {e}"))?;
    }

    Ok(total_paid)
}

pub fn get_payments_for_invoice(
    conn: &Connection,
    invoice_id: i64,
) -> Result<Vec<Payment>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, invoice_id, number, amount, payment_method, payment_date, notes, created_at
             FROM payments WHERE invoice_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| format!("Prepare error: {e}"))?;

    let rows = stmt
        .query_map(params![invoice_id], |row| {
            Ok(Payment {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                number: row.get(2)?,
                amount: row.get(3)?,
                payment_method: row.get(4)?,
                payment_date: row.get(5)?,
                notes: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Query error: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row error: {e}"))
}

pub fn create_payment(
    conn: &Connection,
    payload: &CreatePaymentPayload,
) -> Result<Payment, String> {
    // Verify invoice exists and is "sent"
    let status: String = conn
        .query_row(
            "SELECT status FROM invoices WHERE id = ?1",
            params![payload.invoice_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Invoice not found: {e}"))?;

    if status != "sent" {
        return Err(
            "Le paiement ne peut être enregistré que sur une facture envoyée".to_string(),
        );
    }

    let number = next_receipt_number(conn)?;

    conn.execute(
        "INSERT INTO payments (invoice_id, number, amount, payment_method, payment_date, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            payload.invoice_id,
            number,
            payload.amount,
            payload.payment_method,
            payload.payment_date,
            payload.notes,
        ],
    )
    .map_err(|e| format!("Insert error: {e}"))?;

    let payment_id = conn.last_insert_rowid();

    recalc_amount_paid(conn, payload.invoice_id)?;

    conn.query_row(
        "SELECT id, invoice_id, number, amount, payment_method, payment_date, notes, created_at
         FROM payments WHERE id = ?1",
        params![payment_id],
        |row| {
            Ok(Payment {
                id: row.get(0)?,
                invoice_id: row.get(1)?,
                number: row.get(2)?,
                amount: row.get(3)?,
                payment_method: row.get(4)?,
                payment_date: row.get(5)?,
                notes: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| format!("Fetch error: {e}"))
}

pub fn delete_payment(conn: &Connection, id: i64) -> Result<(), String> {
    let invoice_id: i64 = conn
        .query_row(
            "SELECT invoice_id FROM payments WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Payment not found: {e}"))?;

    conn.execute("DELETE FROM payments WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete error: {e}"))?;

    recalc_amount_paid(conn, invoice_id)?;
    Ok(())
}
