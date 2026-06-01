-- Migration 2: Functions, triggers

-- Function: auto-create profile + role on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INTEGER;
  assigned_role user_role;
BEGIN
  -- Count existing users (before this one)
  SELECT COUNT(*) INTO user_count FROM auth.users WHERE id != NEW.id;
  
  -- First user ever → admin, everyone else → staff
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'staff';
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);

  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, assigned_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function: generate next serial number for a product type
-- Returns e.g. "RNG-0001", "RNG-0002"
CREATE OR REPLACE FUNCTION next_serial(type_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_prefix TEXT;
  v_counter INTEGER;
  v_serial TEXT;
BEGIN
  -- Get prefix
  SELECT prefix INTO v_prefix FROM product_types WHERE id = type_id;
  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Product type not found: %', type_id;
  END IF;

  -- Upsert counter row and increment atomically
  INSERT INTO serial_counters (product_type_id, current_value)
    VALUES (type_id, 1)
    ON CONFLICT (product_type_id)
    DO UPDATE SET current_value = serial_counters.current_value + 1
    RETURNING current_value INTO v_counter;

  -- Format: PREFIX-XXXX (zero-padded to 4 digits)
  v_serial := v_prefix || '-' || LPAD(v_counter::TEXT, 4, '0');

  RETURN v_serial;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION next_serial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
