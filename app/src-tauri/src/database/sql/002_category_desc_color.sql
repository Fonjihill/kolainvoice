-- 002_category_desc_color.sql — Add description & color to categories
ALTER TABLE categories ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#D97706';
