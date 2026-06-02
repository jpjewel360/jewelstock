ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS purchase_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS profit NUMERIC(12,2);

UPDATE sales
SET
  purchase_rate = COALESCE(purchase_rate, sale_price),
  profit = COALESCE(profit, sale_price - COALESCE(purchase_rate, sale_price))
WHERE purchase_rate IS NULL OR profit IS NULL;
