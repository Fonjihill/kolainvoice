-- 008_payments.sql — Payment receipts with partial payment support

CREATE TABLE IF NOT EXISTS payments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id      INTEGER NOT NULL REFERENCES invoices(id),
    number          TEXT NOT NULL UNIQUE,
    amount          INTEGER NOT NULL,
    payment_method  TEXT NOT NULL DEFAULT 'cash',
    payment_date    TEXT NOT NULL DEFAULT (date('now')),
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Migrate existing paid invoices into payments table
INSERT INTO payments (invoice_id, number, amount, payment_method, payment_date, created_at)
SELECT
    id,
    'REC-' || strftime('%Y', COALESCE(payment_date, created_at)) || '-' || printf('%04d', ROW_NUMBER() OVER (ORDER BY COALESCE(payment_date, created_at))),
    amount_paid,
    COALESCE(payment_method, 'cash'),
    COALESCE(payment_date, date(created_at)),
    datetime('now')
FROM invoices
WHERE amount_paid > 0;
