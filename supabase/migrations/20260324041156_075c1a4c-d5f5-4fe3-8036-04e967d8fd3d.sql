-- Ensure pgcrypto is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Fix FK constraints that block UC deletion (change NO ACTION to CASCADE/SET NULL)
ALTER TABLE public.recebimentos DROP CONSTRAINT IF EXISTS recebimentos_unit_id_fkey;
ALTER TABLE public.recebimentos ADD CONSTRAINT recebimentos_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.units_consumidoras(id) ON DELETE SET NULL;

ALTER TABLE public.invoice_import_job_items DROP CONSTRAINT IF EXISTS invoice_import_job_items_unit_id_fkey;
ALTER TABLE public.invoice_import_job_items ADD CONSTRAINT invoice_import_job_items_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.units_consumidoras(id) ON DELETE SET NULL;

ALTER TABLE public.energy_alerts DROP CONSTRAINT IF EXISTS energy_alerts_unit_id_fkey;
ALTER TABLE public.energy_alerts ADD CONSTRAINT energy_alerts_unit_id_fkey
  FOREIGN KEY (unit_id) REFERENCES public.units_consumidoras(id) ON DELETE SET NULL;

-- 2) Create safe delete function for UCs
CREATE OR REPLACE FUNCTION public.delete_uc_permanently(p_unit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_gd_count int;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM units_consumidoras
  WHERE id = p_unit_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UC não encontrada');
  END IF;

  IF v_tenant_id != current_tenant_id() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  SELECT COUNT(*) INTO v_gd_count
  FROM (
    SELECT id FROM gd_groups WHERE uc_geradora_id = p_unit_id
    UNION ALL
    SELECT id FROM gd_group_beneficiaries WHERE uc_beneficiaria_id = p_unit_id
  ) sub;

  IF v_gd_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Esta UC está vinculada a um grupo GD. Remova as associações GD antes de excluir.',
      'gd_associations', v_gd_count
    );
  END IF;

  DELETE FROM units_consumidoras WHERE id = p_unit_id;

  RETURN jsonb_build_object('success', true, 'deleted_unit_id', p_unit_id);
END;
$$;

-- 3) Create client_portal_users table for login-based access
CREATE TABLE IF NOT EXISTS public.client_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.units_consumidoras(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL DEFAULT current_tenant_id() REFERENCES public.tenants(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_users_email_tenant
  ON public.client_portal_users(email, tenant_id);

ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_manage_portal_users" ON public.client_portal_users
  FOR ALL TO authenticated
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- 4) Login RPC for client portal (anon access)
CREATE OR REPLACE FUNCTION public.client_portal_login(p_email text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user client_portal_users%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_user
  FROM client_portal_users
  WHERE email = lower(trim(p_email))
    AND is_active = true
  LIMIT 1;

  IF v_user.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email ou senha inválidos');
  END IF;

  IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email ou senha inválidos');
  END IF;

  SELECT token INTO v_token
  FROM uc_client_tokens
  WHERE unit_id = v_user.unit_id AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_token IS NULL THEN
    INSERT INTO uc_client_tokens (unit_id, label, tenant_id)
    VALUES (v_user.unit_id, 'Login do cliente', v_user.tenant_id)
    RETURNING token INTO v_token;
  END IF;

  UPDATE client_portal_users SET last_login_at = now(), updated_at = now() WHERE id = v_user.id;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'unit_id', v_user.unit_id,
    'email', v_user.email
  );
END;
$$;

-- 5) RPC to create portal user (admin only)
CREATE OR REPLACE FUNCTION public.create_client_portal_user(
  p_unit_id uuid,
  p_email text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_hash text;
  v_user_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM units_consumidoras
  WHERE id = p_unit_id;

  IF v_tenant_id IS NULL OR v_tenant_id != current_tenant_id() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UC não encontrada ou sem permissão');
  END IF;

  v_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO client_portal_users (unit_id, email, password_hash, tenant_id, is_active)
  VALUES (p_unit_id, lower(trim(p_email)), v_hash, v_tenant_id, true)
  ON CONFLICT (email, tenant_id) DO UPDATE SET
    password_hash = v_hash,
    unit_id = p_unit_id,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- 6) RPC to reset portal user password
CREATE OR REPLACE FUNCTION public.reset_client_portal_password(
  p_user_id uuid,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM client_portal_users
  WHERE id = p_user_id;

  IF v_tenant_id IS NULL OR v_tenant_id != current_tenant_id() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
  END IF;

  UPDATE client_portal_users
  SET password_hash = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;