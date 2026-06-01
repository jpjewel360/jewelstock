-- Migration 1: Create enums, tables, and RLS policies

-- Enums
CREATE TYPE item_status AS ENUM ('available', 'sold', 'audit');
CREATE TYPE user_role AS ENUM ('admin', 'staff');

-- Profiles (auto-created on signup via trigger)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User roles
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role user_role NOT NULL DEFAULT 'staff',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product types / categories
CREATE TABLE product_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  purity_percent NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Serial number counters per category
CREATE TABLE serial_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE UNIQUE,
  current_value INTEGER NOT NULL DEFAULT 0
);

-- Inventory items
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID REFERENCES product_types(id),
  serial_number TEXT NOT NULL UNIQUE,
  weight_grams NUMERIC(8,3) NOT NULL,
  purchase_price NUMERIC(12,2) NOT NULL,
  status item_status NOT NULL DEFAULT 'available',
  notes TEXT,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sales records
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  sale_price NUMERIC(12,2) NOT NULL,
  buyer_name TEXT,
  buyer_phone TEXT,
  sold_by UUID REFERENCES auth.users(id),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit sessions
CREATE TABLE audit_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Audit scans
CREATE TABLE audit_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES audit_sessions(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  scanned_by UUID REFERENCES auth.users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE serial_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can read everything
CREATE POLICY "Auth read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read roles" ON user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read types" ON product_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read counters" ON serial_counters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read inventory" ON inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read sales" ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read audit_sessions" ON audit_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read audit_scans" ON audit_scans FOR SELECT TO authenticated USING (true);

-- Staff can insert inventory and sales
CREATE POLICY "Staff insert inventory" ON inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update inventory" ON inventory_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff insert sales" ON sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff insert audit_sessions" ON audit_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update audit_sessions" ON audit_sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff insert audit_scans" ON audit_scans FOR INSERT TO authenticated WITH CHECK (true);

-- Admin-only: manage product types
CREATE POLICY "Admin manage types" ON product_types FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin-only: manage counters
CREATE POLICY "Admin manage counters" ON serial_counters FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin-only: delete inventory
CREATE POLICY "Admin delete inventory" ON inventory_items FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can manage roles
CREATE POLICY "Admin manage roles" ON user_roles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
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
