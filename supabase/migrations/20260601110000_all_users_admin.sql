-- Product decision: no staff role. Every signed-in user is admin.

ALTER TABLE user_roles
  ALTER COLUMN role SET DEFAULT 'admin';

UPDATE user_roles
SET role = 'admin'
WHERE role <> 'admin';

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
