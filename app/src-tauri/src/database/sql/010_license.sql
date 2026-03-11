CREATE TABLE IF NOT EXISTS license (
    id             INTEGER PRIMARY KEY CHECK (id = 1),
    device_id      TEXT NOT NULL,
    license_key    TEXT,
    plan_type      TEXT,
    expiry_date    TEXT,
    trial_start    TEXT NOT NULL DEFAULT (date('now')),
    activated_at   TEXT
);
