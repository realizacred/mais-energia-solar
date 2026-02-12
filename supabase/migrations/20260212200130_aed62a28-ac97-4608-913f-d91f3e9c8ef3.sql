
-- =====================================================
-- MIGRATION: Rename vendedor → consultor (FULL SYSTEM)
-- =====================================================

-- STEP 1: Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS extensions.mv_vendedor_performance;
DROP MATERIALIZED VIEW IF EXISTS extensions.mv_leads_mensal;

-- STEP 2: Drop triggers
DROP TRIGGER IF EXISTS trg_lead_resolve_vendedor_id ON leads;
DROP TRIGGER IF EXISTS generate_vendedor_codigo_trigger ON vendedores;
DROP TRIGGER IF EXISTS update_vendedor_slug_trigger ON vendedores;
DROP TRIGGER IF EXISTS audit_vendedores ON vendedores;

-- STEP 3: Drop old functions
DROP FUNCTION IF EXISTS generate_vendedor_codigo() CASCADE;
DROP FUNCTION IF EXISTS generate_vendedor_slug(text) CASCADE;
DROP FUNCTION IF EXISTS update_vendedor_slug() CASCADE;
DROP FUNCTION IF EXISTS validate_vendedor_code(text) CASCADE;
DROP FUNCTION IF EXISTS resolve_vendedor_public(text) CASCADE;
DROP FUNCTION IF EXISTS resolve_default_vendedor_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS resolve_lead_vendedor_id() CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_vendedor_performance() CASCADE;
DROP FUNCTION IF EXISTS get_dashboard_leads_mensal() CASCADE;
DROP FUNCTION IF EXISTS resolve_public_tenant_id(text) CASCADE;

-- STEP 4: Rename enum value
ALTER TYPE app_role RENAME VALUE 'vendedor' TO 'consultor';

-- STEP 5: Rename tables
ALTER TABLE vendedores RENAME TO consultores;
ALTER TABLE vendedor_achievements RENAME TO consultor_achievements;
ALTER TABLE vendedor_metas RENAME TO consultor_metas;
ALTER TABLE vendedor_metricas RENAME TO consultor_metricas;
ALTER TABLE vendedor_performance_mensal RENAME TO consultor_performance_mensal;
ALTER TABLE wa_instance_vendedores RENAME TO wa_instance_consultores;

-- STEP 6: Rename columns
ALTER TABLE leads RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE leads RENAME COLUMN vendedor TO consultor;
ALTER TABLE orcamentos RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE orcamentos RENAME COLUMN vendedor TO consultor;
ALTER TABLE comissoes RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE projetos RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE propostas RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE checklists_cliente RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE sla_breaches RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE meta_notifications RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE lead_distribution_log RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE lead_distribution_log RENAME COLUMN vendedor_anterior_id TO consultor_anterior_id;
ALTER TABLE vendor_invites RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE wa_instances RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE wa_instance_consultores RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE consultor_achievements RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE consultor_metas RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE consultor_metricas RENAME COLUMN vendedor_id TO consultor_id;
ALTER TABLE consultor_performance_mensal RENAME COLUMN vendedor_id TO consultor_id;

-- STEP 7: Rename indexes
ALTER INDEX IF EXISTS idx_leads_vendedor RENAME TO idx_leads_consultor;
ALTER INDEX IF EXISTS idx_leads_vendedor_id RENAME TO idx_leads_consultor_id;
ALTER INDEX IF EXISTS idx_leads_tenant_vendedor RENAME TO idx_leads_tenant_consultor;
ALTER INDEX IF EXISTS idx_comissoes_vendedor_id RENAME TO idx_comissoes_consultor_id;
ALTER INDEX IF EXISTS idx_distribution_log_vendedor RENAME TO idx_distribution_log_consultor;
ALTER INDEX IF EXISTS idx_sla_breaches_vendedor RENAME TO idx_sla_breaches_consultor;
ALTER INDEX IF EXISTS idx_vendedores_user_id RENAME TO idx_consultores_user_id;
ALTER INDEX IF EXISTS idx_vendedores_codigo RENAME TO idx_consultores_codigo;
ALTER INDEX IF EXISTS idx_vendedores_tenant RENAME TO idx_consultores_tenant;
ALTER INDEX IF EXISTS vendedores_slug_unique RENAME TO consultores_slug_unique;
ALTER INDEX IF EXISTS idx_projetos_vendedor_id RENAME TO idx_projetos_consultor_id;
ALTER INDEX IF EXISTS idx_orcamentos_vendedor RENAME TO idx_orcamentos_consultor;
ALTER INDEX IF EXISTS idx_orcamentos_vendedor_id RENAME TO idx_orcamentos_consultor_id;
ALTER INDEX IF EXISTS idx_propostas_vendedor_id RENAME TO idx_propostas_consultor_id;
ALTER INDEX IF EXISTS idx_vendor_invites_vendedor RENAME TO idx_vendor_invites_consultor;
ALTER INDEX IF EXISTS idx_wa_instance_vendedores_instance RENAME TO idx_wa_instance_consultores_instance;
ALTER INDEX IF EXISTS idx_wa_instance_vendedores_vendedor RENAME TO idx_wa_instance_consultores_consultor;
ALTER INDEX IF EXISTS meta_notifications_unique_per_vendedor_meta RENAME TO meta_notifications_unique_per_consultor_meta;

-- STEP 8: Recreate materialized views FIRST
CREATE MATERIALIZED VIEW extensions.mv_consultor_performance AS
SELECT COALESCE(consultor, 'Admin'::text) AS consultor,
    count(*) AS total_leads, sum(media_consumo) AS total_kwh,
    count(CASE WHEN status_id IS NOT NULL THEN 1 ELSE NULL::integer END) AS leads_com_status,
    (date_trunc('month'::text, now()))::date AS periodo
FROM leads l WHERE created_at >= (now() - '6 mons'::interval)
GROUP BY COALESCE(consultor, 'Admin'::text) ORDER BY count(*) DESC;
CREATE UNIQUE INDEX ON extensions.mv_consultor_performance (consultor);

CREATE MATERIALIZED VIEW extensions.mv_leads_mensal AS
SELECT (date_trunc('month'::text, created_at))::date AS mes,
    count(*) AS total_leads, sum(media_consumo) AS total_kwh,
    round(avg(media_consumo)) AS media_consumo,
    count(DISTINCT estado) AS estados_unicos,
    count(DISTINCT consultor) AS consultores_ativos
FROM leads WHERE created_at >= (now() - '1 year'::interval)
GROUP BY date_trunc('month'::text, created_at)
ORDER BY (date_trunc('month'::text, created_at))::date DESC;
CREATE UNIQUE INDEX ON extensions.mv_leads_mensal (mes);

-- STEP 9: Create renamed functions
CREATE OR REPLACE FUNCTION public.generate_consultor_slug(nome text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $$
DECLARE base_slug TEXT;
BEGIN
  base_slug := lower(translate(nome, 'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜàáâãäåèéêëìíîïòóôõöùúûüÇçÑñ', 'AAAAAAEEEEIIIIOOOOOUUUUaaaaaaeeeeiiiioooooouuuuCcNn'));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  RETURN trim(both '-' from base_slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_consultor_codigo()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE prefix TEXT; seq_num INTEGER; new_codigo TEXT; exists_count INTEGER; base_slug TEXT; final_slug TEXT; slug_suffix INTEGER;
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' OR NEW.codigo = 'temp' THEN
    prefix := upper(translate(substring(regexp_replace(NEW.nome, '[^a-zA-ZÀ-ÿ]', '', 'g') from 1 for 3), 'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜàáâãäåèéêëìíîïòóôõöùúûüÇçÑñ', 'AAAAAAEEEEIIIIOOOOOUUUUaaaaaaeeeeiiiioooooouuuuCcNn'));
    prefix := rpad(prefix, 3, 'X');
    SELECT COALESCE(MAX(CASE WHEN substring(codigo from 4) ~ '^\d+$' THEN substring(codigo from 4)::integer ELSE 0 END), 0) + 1 INTO seq_num FROM consultores WHERE upper(substring(codigo from 1 for 3)) = prefix AND id != NEW.id;
    new_codigo := prefix || lpad(seq_num::text, 3, '0');
    SELECT COUNT(*) INTO exists_count FROM consultores WHERE codigo = new_codigo AND id != NEW.id;
    WHILE exists_count > 0 LOOP seq_num := seq_num + 1; new_codigo := prefix || lpad(seq_num::text, 3, '0'); SELECT COUNT(*) INTO exists_count FROM consultores WHERE codigo = new_codigo AND id != NEW.id; END LOOP;
    NEW.codigo := new_codigo;
  END IF;
  base_slug := generate_consultor_slug(NEW.nome); final_slug := base_slug; slug_suffix := 1;
  LOOP SELECT COUNT(*) INTO exists_count FROM consultores WHERE slug = final_slug AND id != NEW.id; EXIT WHEN exists_count = 0; slug_suffix := slug_suffix + 1; final_slug := base_slug || '-' || slug_suffix; END LOOP;
  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_consultor_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE base_slug TEXT; final_slug TEXT; exists_count INTEGER; slug_suffix INTEGER;
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    base_slug := generate_consultor_slug(NEW.nome); final_slug := base_slug; slug_suffix := 1;
    LOOP SELECT COUNT(*) INTO exists_count FROM consultores WHERE slug = final_slug AND id != NEW.id; EXIT WHEN exists_count = 0; slug_suffix := slug_suffix + 1; final_slug := base_slug || '-' || slug_suffix; END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_consultor_code(_codigo text)
RETURNS TABLE(codigo text, nome text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT v.codigo, v.nome FROM consultores v WHERE (v.codigo = _codigo OR v.slug = _codigo) AND v.ativo = true; $$;

CREATE OR REPLACE FUNCTION public.resolve_consultor_public(_codigo text)
RETURNS TABLE(id uuid, nome text, codigo text, slug text, tenant_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT v.id, v.nome, v.codigo, v.slug, v.tenant_id FROM consultores v WHERE (v.codigo = _codigo OR v.slug = _codigo) AND v.ativo = true LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.resolve_default_consultor_id(_tenant_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _cid uuid;
BEGIN
  SELECT v.id INTO _cid FROM user_roles ur JOIN profiles p ON p.user_id = ur.user_id JOIN consultores v ON v.user_id = ur.user_id AND v.tenant_id = _tenant_id AND v.ativo = true WHERE ur.role::text = 'admin' AND p.tenant_id = _tenant_id ORDER BY v.created_at ASC LIMIT 1;
  IF _cid IS NOT NULL THEN RETURN _cid; END IF;
  SELECT v.id INTO _cid FROM consultores v WHERE v.tenant_id = _tenant_id AND v.ativo = true ORDER BY v.created_at ASC LIMIT 1;
  IF _cid IS NOT NULL THEN RETURN _cid; END IF;
  RAISE EXCEPTION 'resolve_default_consultor_id: nenhum consultor ativo para tenant=%', _tenant_id USING ERRCODE = 'P0402';
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_lead_consultor_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _dummy uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF (NEW.consultor_id IS NULL OR NEW.consultor_id = _dummy) AND NEW.tenant_id IS NOT NULL THEN
    BEGIN NEW.consultor_id := resolve_default_consultor_id(NEW.tenant_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF (NEW.consultor IS NULL OR NEW.consultor = '' OR NEW.consultor = 'Site') AND NEW.consultor_id IS NOT NULL AND NEW.consultor_id != _dummy THEN
    SELECT v.nome INTO NEW.consultor FROM consultores v WHERE v.id = NEW.consultor_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_consultor_performance()
RETURNS TABLE(consultor text, total_leads bigint, total_kwh bigint, leads_com_status bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT consultor, total_leads, total_kwh, leads_com_status FROM extensions.mv_consultor_performance ORDER BY total_leads DESC LIMIT 10; $$;

CREATE OR REPLACE FUNCTION public.get_dashboard_leads_mensal()
RETURNS TABLE(mes date, total_leads bigint, total_kwh bigint, media_consumo numeric, estados_unicos bigint, consultores_ativos bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT mes, total_leads, total_kwh, media_consumo, estados_unicos, consultores_ativos FROM extensions.mv_leads_mensal ORDER BY mes DESC; $$;

-- STEP 10: Update internal-reference functions
CREATE OR REPLACE FUNCTION public.resolve_lead_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _resolved uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL THEN _resolved := get_user_tenant_id(); IF _resolved IS NOT NULL THEN NEW.tenant_id := _resolved; RETURN NEW; END IF; END IF;
  IF NEW.consultor IS NOT NULL AND TRIM(NEW.consultor) != '' THEN
    SELECT v.tenant_id INTO _resolved FROM consultores v WHERE (v.codigo = NEW.consultor OR v.slug = NEW.consultor OR v.nome = NEW.consultor) AND v.ativo = true LIMIT 1;
    IF _resolved IS NOT NULL THEN NEW.tenant_id := _resolved; RETURN NEW; END IF;
  END IF;
  NEW.tenant_id := resolve_public_tenant_id(); RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_orc_tenant_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _resolved uuid;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL THEN _resolved := get_user_tenant_id(); IF _resolved IS NOT NULL THEN NEW.tenant_id := _resolved; RETURN NEW; END IF; END IF;
  IF NEW.lead_id IS NOT NULL THEN SELECT l.tenant_id INTO _resolved FROM leads l WHERE l.id = NEW.lead_id LIMIT 1; IF _resolved IS NOT NULL THEN NEW.tenant_id := _resolved; RETURN NEW; END IF; END IF;
  IF NEW.consultor IS NOT NULL AND TRIM(NEW.consultor) != '' THEN
    SELECT v.tenant_id INTO _resolved FROM consultores v WHERE (v.codigo = NEW.consultor OR v.slug = NEW.consultor OR v.nome = NEW.consultor) AND v.ativo = true LIMIT 1;
    IF _resolved IS NOT NULL THEN NEW.tenant_id := _resolved; RETURN NEW; END IF;
  END IF;
  NEW.tenant_id := resolve_public_tenant_id(); RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_wa_conversation(_conversation_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM wa_conversations wc LEFT JOIN wa_instances wi ON wi.id = wc.instance_id
    WHERE wc.id = _conversation_id AND wc.tenant_id = get_user_tenant_id(_user_id)
      AND (wc.assigned_to = _user_id OR wi.owner_user_id = _user_id
        OR EXISTS (SELECT 1 FROM wa_instance_consultores wiv JOIN consultores v ON v.id = wiv.consultor_id WHERE wiv.instance_id = wi.id AND v.user_id = _user_id AND v.ativo = true)))
$$;

CREATE OR REPLACE FUNCTION public.resolve_phone_to_email(_phone text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _normalized text; _email text;
BEGIN
  _normalized := regexp_replace(_phone, '[^0-9]', '', 'g');
  SELECT u.email INTO _email FROM consultores v JOIN auth.users u ON u.id = v.user_id WHERE regexp_replace(v.telefone, '[^0-9]', '', 'g') = _normalized AND v.ativo = true AND v.user_id IS NOT NULL LIMIT 1;
  IF _email IS NULL THEN SELECT u.email INTO _email FROM profiles p JOIN auth.users u ON u.id = p.user_id WHERE p.telefone IS NOT NULL AND regexp_replace(p.telefone, '[^0-9]', '', 'g') = _normalized AND p.ativo = true LIMIT 1; END IF;
  RETURN _email;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_public_tenant_id(_consultor_code text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _tenant uuid; _count integer;
BEGIN
  IF _consultor_code IS NOT NULL AND TRIM(_consultor_code) != '' THEN
    SELECT v.tenant_id INTO _tenant FROM consultores v WHERE (v.codigo = _consultor_code OR v.slug = _consultor_code) AND v.ativo = true LIMIT 1;
    IF _tenant IS NOT NULL THEN RETURN _tenant; END IF;
  END IF;
  SELECT COUNT(*) INTO _count FROM tenants WHERE ativo = true;
  IF _count = 0 THEN RAISE EXCEPTION 'resolve_public_tenant_id: nenhum tenant ativo' USING ERRCODE = 'P0402'; END IF;
  IF _count > 1 THEN RAISE EXCEPTION 'resolve_public_tenant_id: múltiplos tenants ativos (%).', _count USING ERRCODE = 'P0402'; END IF;
  SELECT id INTO _tenant FROM tenants WHERE ativo = true LIMIT 1;
  RETURN _tenant;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_leads_mensal;
  REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_leads_por_estado;
  REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_consultor_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY extensions.mv_pipeline_stats;
  REFRESH MATERIALIZED VIEW extensions.mv_financeiro_resumo;
END;
$$;

-- STEP 11: Recreate triggers
CREATE TRIGGER trg_lead_resolve_consultor_id BEFORE INSERT ON leads FOR EACH ROW EXECUTE FUNCTION resolve_lead_consultor_id();
CREATE TRIGGER generate_consultor_codigo_trigger BEFORE INSERT ON consultores FOR EACH ROW EXECUTE FUNCTION generate_consultor_codigo();
CREATE TRIGGER update_consultor_slug_trigger BEFORE UPDATE ON consultores FOR EACH ROW EXECUTE FUNCTION update_consultor_slug();
CREATE TRIGGER audit_consultores AFTER INSERT OR UPDATE OR DELETE ON consultores FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_fn();

-- STEP 12: Rename policies
ALTER POLICY "rls_clientes_select_vendedor" ON clientes RENAME TO "rls_clientes_select_consultor";
ALTER POLICY "rls_comissoes_select_vendedor" ON comissoes RENAME TO "rls_comissoes_select_consultor";
ALTER POLICY "rls_lead_scores_select_vendedor" ON lead_scores RENAME TO "rls_lead_scores_select_consultor";
ALTER POLICY "rls_leads_select_vendedor" ON leads RENAME TO "rls_leads_select_consultor";
ALTER POLICY "rls_meta_notifications_all_vendedor" ON meta_notifications RENAME TO "rls_meta_notifications_all_consultor";
ALTER POLICY "rls_orcamentos_select_vendedor" ON orcamentos RENAME TO "rls_orcamentos_select_consultor";
ALTER POLICY "rls_orcamentos_update_vendedor" ON orcamentos RENAME TO "rls_orcamentos_update_consultor";
ALTER POLICY "rls_orcamentos_delete_vendedor" ON orcamentos RENAME TO "rls_orcamentos_delete_consultor";
ALTER POLICY "rls_projetos_select_vendedor" ON projetos RENAME TO "rls_projetos_select_consultor";
ALTER POLICY "rls_proposta_itens_select_vendedor" ON proposta_itens RENAME TO "rls_proposta_itens_select_consultor";
ALTER POLICY "rls_proposta_variaveis_select_vendedor" ON proposta_variaveis RENAME TO "rls_proposta_variaveis_select_consultor";
ALTER POLICY "rls_propostas_select_vendedor" ON propostas RENAME TO "rls_propostas_select_consultor";
ALTER POLICY "rls_vendedor_achievements_select_own" ON consultor_achievements RENAME TO "rls_consultor_achievements_select_own";
ALTER POLICY "rls_vendedor_achievements_all_admin" ON consultor_achievements RENAME TO "rls_consultor_achievements_all_admin";
ALTER POLICY "rls_vendedor_metas_select_own" ON consultor_metas RENAME TO "rls_consultor_metas_select_own";
ALTER POLICY "rls_vendedor_metas_all_admin" ON consultor_metas RENAME TO "rls_consultor_metas_all_admin";
ALTER POLICY "rls_vendedor_metricas_select_own" ON consultor_metricas RENAME TO "rls_consultor_metricas_select_own";
ALTER POLICY "rls_vendedor_metricas_all_admin" ON consultor_metricas RENAME TO "rls_consultor_metricas_all_admin";
ALTER POLICY "rls_vendedor_performance_mensal_select_own" ON consultor_performance_mensal RENAME TO "rls_consultor_performance_mensal_select_own";
ALTER POLICY "rls_vendedor_performance_mensal_all_admin" ON consultor_performance_mensal RENAME TO "rls_consultor_performance_mensal_all_admin";
ALTER POLICY "rls_vendedores_select_tenant" ON consultores RENAME TO "rls_consultores_select_tenant";
ALTER POLICY "rls_vendedores_all_admin" ON consultores RENAME TO "rls_consultores_all_admin";
ALTER POLICY "rls_wa_instance_vendedores_admin_all" ON wa_instance_consultores RENAME TO "rls_wa_instance_consultores_admin_all";
ALTER POLICY "rls_wa_instance_vendedores_admin" ON wa_instance_consultores RENAME TO "rls_wa_instance_consultores_admin";
ALTER POLICY "rls_wa_instance_vendedores_vendor_select_own" ON wa_instance_consultores RENAME TO "rls_wa_instance_consultores_consultor_select_own";
ALTER POLICY "rls_wa_instance_vendedores_service" ON wa_instance_consultores RENAME TO "rls_wa_instance_consultores_service";
ALTER POLICY "rls_wa_instance_vendedores_select_vendor" ON wa_instance_consultores RENAME TO "rls_wa_instance_consultores_select_consultor";

COMMENT ON TABLE consultores IS 'Consultores de vendas (renomeada de vendedores).';
