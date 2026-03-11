-- 003_settings_fields.sql — Add missing settings fields for full mockup support

-- Entreprise: bank details
ALTER TABLE settings ADD COLUMN bank_name TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN bank_account TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN bank_swift TEXT NOT NULL DEFAULT '';

-- Factures: numbering & defaults
ALTER TABLE settings ADD COLUMN next_invoice_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN next_quote_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN payment_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE settings ADD COLUMN quote_validity_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE settings ADD COLUMN default_mentions TEXT NOT NULL DEFAULT 'Paiement par virement ou Mobile Money sous 30 jours.';

-- Impression / PDF
ALTER TABLE settings ADD COLUMN paper_format TEXT NOT NULL DEFAULT 'A4';
ALTER TABLE settings ADD COLUMN default_copies INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN pdf_include_logo INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN pdf_include_stamp INTEGER NOT NULL DEFAULT 1;
ALTER TABLE settings ADD COLUMN pdf_watermark_draft INTEGER NOT NULL DEFAULT 1;

-- Langue / locale
ALTER TABLE settings ADD COLUMN date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY';
ALTER TABLE settings ADD COLUMN thousand_separator TEXT NOT NULL DEFAULT 'space';
