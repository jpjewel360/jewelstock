-- Dynamic category fields and category product lists.
-- Keeps existing product_types/inventory_items data compatible.

ALTER TABLE product_types
  ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '[{"id":"weight_grams","label":"Weight","type":"number","required":true,"builtin":true}]'::jsonb,
  ADD COLUMN IF NOT EXISTS products JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS field_values JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE inventory_items
  ALTER COLUMN purchase_price DROP NOT NULL;

UPDATE inventory_items i
SET product_name = pt.name
FROM product_types pt
WHERE i.product_type_id = pt.id
  AND i.product_name IS NULL;
