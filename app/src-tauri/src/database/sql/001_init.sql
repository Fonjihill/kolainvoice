-- 001_init.sql — Initial schema for Kola Invoice V1
-- IMMUTABLE: never modify this file after shipping. Use 002_*.sql for changes.

CREATE TABLE IF NOT EXISTS settings (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    company_name    TEXT NOT NULL DEFAULT '',
    company_address TEXT NOT NULL DEFAULT '',
    company_phone   TEXT NOT NULL DEFAULT '',
    company_email   TEXT NOT NULL DEFAULT '',
    company_niu     TEXT NOT NULL DEFAULT '',
    company_rccm    TEXT NOT NULL DEFAULT '',
    logo_path       TEXT,
    stamp_path      TEXT,
    tva_enabled     INTEGER NOT NULL DEFAULT 0,
    tva_rate        REAL NOT NULL DEFAULT 19.25,
    default_printer TEXT,
    language        TEXT NOT NULL DEFAULT 'fr',
    invoice_prefix  TEXT NOT NULL DEFAULT 'FAC',
    quote_prefix    TEXT NOT NULL DEFAULT 'DEV',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed the single settings row
INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS clients (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    niu         TEXT NOT NULL DEFAULT '',
    phone       TEXT NOT NULL DEFAULT '',
    email       TEXT NOT NULL DEFAULT '',
    address     TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '',
    archived    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS catalogue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type       TEXT NOT NULL DEFAULT 'service' CHECK (item_type IN ('product','service')),
    category_id     INTEGER REFERENCES categories(id),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    unit_price      INTEGER NOT NULL DEFAULT 0,
    unit            TEXT NOT NULL DEFAULT 'unité',
    tva_applicable  INTEGER NOT NULL DEFAULT 1,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quotes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    number          TEXT NOT NULL UNIQUE,
    client_id       INTEGER NOT NULL REFERENCES clients(id),
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','refused','expired','cancelled')),
    issue_date      TEXT NOT NULL DEFAULT (date('now')),
    validity_date   TEXT,
    notes           TEXT NOT NULL DEFAULT '',
    subtotal        INTEGER NOT NULL DEFAULT 0,
    tva_amount      INTEGER NOT NULL DEFAULT 0,
    total           INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quote_lines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id        INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    catalogue_id    INTEGER REFERENCES catalogue(id),
    description     TEXT NOT NULL DEFAULT '',
    quantity        REAL NOT NULL DEFAULT 1,
    unit_price      INTEGER NOT NULL DEFAULT 0,
    discount        REAL NOT NULL DEFAULT 0,
    tva_rate        REAL NOT NULL DEFAULT 0,
    line_total      INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
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
    payment_method  TEXT CHECK (payment_method IN ('cash','mtn_momo','orange_money','virement','cheque')),
    payment_date    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id      INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    catalogue_id    INTEGER REFERENCES catalogue(id),
    description     TEXT NOT NULL DEFAULT '',
    quantity        REAL NOT NULL DEFAULT 1,
    unit_price      INTEGER NOT NULL DEFAULT 0,
    discount        REAL NOT NULL DEFAULT 0,
    tva_rate        REAL NOT NULL DEFAULT 0,
    line_total      INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0
);
