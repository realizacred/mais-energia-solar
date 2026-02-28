
-- ═══════════════════════════════════════════════════════════
-- HARDENING TRIGGERS PÓS-VENDA + RPC GARANTIAS + STORAGE
-- ═══════════════════════════════════════════════════════════

-- 1) Drop existing triggers to recreate hardened versions
DROP TRIGGER IF EXISTS trg_auto_post_sale_plan ON projetos;
DROP TRIGGER IF EXISTS trg_auto_next_preventive ON post_sale_visits;
DROP FUNCTION IF EXISTS fn_auto_create_post_sale_plan() CASCADE;
DROP FUNCTION IF EXISTS fn_auto_next_preventive() CASCADE;
DROP FUNCTION IF EXISTS try_create_post_sale_visit(uuid, uuid, uuid, date) CASCADE;

-- 2) Advisory-lock helper to prevent duplicate visits
CREATE OR REPLACE FUNCTION public.try_create_post_sale_visit(
  p_tenant_id uuid, p_projeto_id uuid, p_plan_id uuid, p_data_prevista date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ps_plan_' || p_plan_id::text));

  IF EXISTS (
    SELECT 1 FROM post_sale_visits
    WHERE plan_id = p_plan_id AND data_prevista = p_data_prevista AND tenant_id = p_tenant_id
  ) THEN
    RETURN NULL; -- already exists, skip
  END IF;

  INSERT INTO post_sale_visits (tenant_id, projeto_id, plan_id, cliente_id, tipo, status, data_prevista)
  SELECT p_tenant_id, p_projeto_id, p_plan_id, psp.cliente_id, 'preventiva', 'pendente', p_data_prevista
  FROM post_sale_plans psp WHERE psp.id = p_plan_id
  RETURNING id INTO v_new_id;

  UPDATE post_sale_plans SET proxima_preventiva = p_data_prevista WHERE id = p_plan_id;

  RETURN v_new_id;
END;
$$;

-- 3) Trigger 1: projeto → instalado (hardened)
CREATE OR REPLACE FUNCTION fn_auto_create_post_sale_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_initial_date date;
BEGIN
  IF NEW.status = 'instalado' AND (OLD.status IS NULL OR OLD.status <> 'instalado')
     AND NEW.data_instalacao IS NOT NULL THEN

    -- Check no plan exists
    IF EXISTS (
      SELECT 1 FROM post_sale_plans WHERE tenant_id = NEW.tenant_id AND projeto_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    v_initial_date := (NEW.data_instalacao::date + INTERVAL '12 months')::date;

    INSERT INTO post_sale_plans (
      tenant_id, projeto_id, cliente_id, status, data_inicio,
      proxima_preventiva, periodicidade_meses
    ) VALUES (
      NEW.tenant_id, NEW.id, NEW.cliente_id, 'active', NEW.data_instalacao,
      v_initial_date, 12
    ) RETURNING id INTO v_plan_id;

    INSERT INTO post_sale_visits (
      tenant_id, projeto_id, plan_id, cliente_id, tipo, status, data_prevista
    ) VALUES (
      NEW.tenant_id, NEW.id, v_plan_id, NEW.cliente_id, 'preventiva', 'pendente', v_initial_date
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_post_sale_plan
AFTER UPDATE ON projetos
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION fn_auto_create_post_sale_plan();

-- 4) Trigger 2: concluir preventiva → criar próxima (hardened)
CREATE OR REPLACE FUNCTION fn_auto_next_preventive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_next_date date;
BEGIN
  IF NEW.tipo = 'preventiva'
     AND NEW.status = 'concluido'
     AND (OLD.status IS NULL OR OLD.status <> 'concluido')
     AND NEW.plan_id IS NOT NULL THEN

    SELECT * INTO v_plan FROM post_sale_plans
    WHERE id = NEW.plan_id AND tenant_id = NEW.tenant_id AND status = 'active';

    IF FOUND THEN
      v_next_date := (COALESCE(NEW.data_prevista, CURRENT_DATE) + (v_plan.periodicidade_meses * INTERVAL '1 month'))::date;
      PERFORM try_create_post_sale_visit(NEW.tenant_id, NEW.projeto_id, NEW.plan_id, v_next_date);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_next_preventive
AFTER UPDATE ON post_sale_visits
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION fn_auto_next_preventive();

-- 5) RPC para garantias vencendo em 3 meses
CREATE OR REPLACE FUNCTION public.rpc_post_sale_guarantees_expiring(p_tenant_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT id)::integer
  FROM post_sale_plans
  WHERE status = 'active'
    AND tenant_id = COALESCE(p_tenant_id, (SELECT get_user_tenant_id()))
    AND (
      (garantia_inversor_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
      OR
      (garantia_modulos_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days')
    );
$$;

-- 6) Storage bucket for post-sale attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('post_sale_attachments', 'post_sale_attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Tenant users can upload post-sale attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'post_sale_attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);

CREATE POLICY "Tenant users can view post-sale attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'post_sale_attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);

CREATE POLICY "Tenant users can delete post-sale attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'post_sale_attachments'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = (SELECT get_user_tenant_id()::text)
);
