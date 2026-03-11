-- 006_settings_updates.sql — Add settings for backup alerts and auto-update

ALTER TABLE settings ADD COLUMN auto_backup_alert INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN update_auto_check INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN update_notify INTEGER NOT NULL DEFAULT 1;
