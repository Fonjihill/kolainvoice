-- 007_quote_invoice_link.sql — Track which invoice was created from a quote
ALTER TABLE quotes ADD COLUMN invoice_id INTEGER REFERENCES invoices(id);
