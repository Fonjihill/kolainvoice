-- 004_quote_object.sql — Add 'object' field to quotes (subject/title of the quote)
ALTER TABLE quotes ADD COLUMN object TEXT NOT NULL DEFAULT '';
