-- 005_relax_payment_method.sql — Remove CHECK constraint on payment_method
-- SQLite doesn't support ALTER COLUMN, so we recreate the table

CREATE TABLE invoices_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    number          TEXT NOT NULL UNIQUE,
    client_id       INTEGER NOT NULL REFERENCES clients(id),
    quote_id        INTEGER REFERENCES quotes(id),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
    issue_date      TEXT NOT NULL DEFAULT (date('now')),
    due_date        TEXT,
    notes           TEXT NOT NULL DEFAULT '',
    subtotal        INTEGER NOT NULL DEFAULT 0,
    tva_amount      INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    amount_paid     INTEGER NOT NULL DEFAULT 0,
    payment_method  TEXT,
    payment_date    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO invoices_new SELECT * FROM invoices;
DROP TABLE invoices;
ALTER TABLE invoices_new RENAME TO invoices;
