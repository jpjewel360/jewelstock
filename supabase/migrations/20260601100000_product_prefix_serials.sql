-- Generate serial numbers from product name prefix, max 3 letters.
-- Example: Bracelet -> BRA-0001, Ring -> RIN-0001.

CREATE OR REPLACE FUNCTION next_serial(type_id UUID, product_name_input TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_last INTEGER;
BEGIN
  IF product_name_input IS NULL OR LENGTH(TRIM(product_name_input)) = 0 THEN
    RAISE EXCEPTION 'Product name is required for serial generation';
  END IF;

  v_prefix := UPPER(SUBSTRING(REGEXP_REPLACE(product_name_input, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 3));
  IF LENGTH(v_prefix) < 3 THEN
    v_prefix := RPAD(v_prefix, 3, 'X');
  END IF;

  SELECT COALESCE(MAX((SUBSTRING(serial_number FROM '^[A-Z0-9]{3}-([0-9]+)$'))::INTEGER), 0)
    INTO v_last
  FROM inventory_items
  WHERE serial_number LIKE v_prefix || '-%';

  RETURN v_prefix || '-' || LPAD((v_last + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION next_serial(UUID, TEXT) TO authenticated;
