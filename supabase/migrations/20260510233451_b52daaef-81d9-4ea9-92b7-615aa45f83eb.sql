
-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Tabela de vínculo manual lead ↔ cliente
CREATE TABLE IF NOT EXISTS public.lead_cliente_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  reason text,
  linked_by uuid,
  linked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_cliente_links_tenant ON public.lead_cliente_links(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_cliente_links_cliente ON public.lead_cliente_links(cliente_id);

-- Tenant integrity: lead, cliente e link devem ser do mesmo tenant
CREATE OR REPLACE FUNCTION public.lead_cliente_links_check_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_tenant uuid;
  v_cliente_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_lead_tenant FROM public.leads WHERE id = NEW.lead_id;
  SELECT tenant_id INTO v_cliente_tenant FROM public.clientes WHERE id = NEW.cliente_id;

  IF v_lead_tenant IS NULL OR v_cliente_tenant IS NULL THEN
    RAISE EXCEPTION 'lead ou cliente inexistente';
  END IF;
  IF v_lead_tenant <> NEW.tenant_id OR v_cliente_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'lead/cliente não pertencem ao mesmo tenant do vínculo';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_cliente_links_tenant ON public.lead_cliente_links;
CREATE TRIGGER trg_lead_cliente_links_tenant
  BEFORE INSERT OR UPDATE ON public.lead_cliente_links
  FOR EACH ROW EXECUTE FUNCTION public.lead_cliente_links_check_tenant();

-- updated_at
DROP TRIGGER IF EXISTS trg_lead_cliente_links_updated ON public.lead_cliente_links;
CREATE TRIGGER trg_lead_cliente_links_updated
  BEFORE UPDATE ON public.lead_cliente_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.lead_cliente_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lcl_select_tenant" ON public.lead_cliente_links;
CREATE POLICY "lcl_select_tenant" ON public.lead_cliente_links
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "lcl_insert_tenant" ON public.lead_cliente_links;
CREATE POLICY "lcl_insert_tenant" ON public.lead_cliente_links
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "lcl_update_tenant" ON public.lead_cliente_links;
CREATE POLICY "lcl_update_tenant" ON public.lead_cliente_links
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "lcl_delete_tenant" ON public.lead_cliente_links;
CREATE POLICY "lcl_delete_tenant" ON public.lead_cliente_links
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- 3) Recriar vw_orcamentos_comercial com 3º critério (vínculo manual)
CREATE OR REPLACE VIEW public.vw_orcamentos_comercial AS
WITH matched_leads AS (
  SELECT
    o_1.id AS orcamento_id,
    COALESCE(
      manual.cliente_id,
      auto.id
    ) AS matched_cliente_id
  FROM orcamentos o_1
  JOIN leads l_1 ON o_1.lead_id = l_1.id
  LEFT JOIN public.lead_cliente_links manual
    ON manual.lead_id = l_1.id
   AND manual.tenant_id = o_1.tenant_id
  LEFT JOIN LATERAL (
    SELECT c_1.id
    FROM clientes c_1
    WHERE c_1.tenant_id = o_1.tenant_id
      AND (
        (l_1.telefone_normalized IS NOT NULL
         AND c_1.telefone_normalized IS NOT NULL
         AND l_1.telefone_normalized = c_1.telefone_normalized)
        OR
        (l_1.email IS NOT NULL
         AND c_1.email IS NOT NULL
         AND lower(l_1.email) = lower(c_1.email))
      )
    LIMIT 1
  ) auto ON true
)
SELECT
  o.id, o.orc_code, o.lead_id, o.cep, o.estado, o.cidade, o.bairro, o.rua,
  o.numero, o.complemento, o.area, o.tipo_telhado, o.rede_atendimento,
  o.media_consumo, o.consumo_previsto, o.arquivos_urls, o.observacoes,
  o.consultor, o.status_id, o.visto, o.visto_admin, o.ultimo_contato,
  o.proxima_acao, o.data_proxima_acao, o.created_at, o.updated_at,
  o.tenant_id, o.regime_compensacao, o.tipo_ligacao, o.concessionaria_id,
  o.consultor_id,
  l.nome AS lead_nome,
  l.telefone AS lead_telefone,
  l.telefone_normalized AS lead_telefone_normalized,
  l.email AS lead_email,
  l.lead_code,
  ml.matched_cliente_id,
  (SELECT pr.id FROM projetos pr
    WHERE pr.cliente_id = ml.matched_cliente_id
    ORDER BY pr.created_at DESC LIMIT 1) AS matched_projeto_id,
  COALESCE(p.count, 0::bigint) AS proposal_count,
  COALESCE(pr_count.count, 0::bigint) AS project_count,
  ls.nome AS lead_status_nome
FROM orcamentos o
JOIN leads l ON o.lead_id = l.id
LEFT JOIN matched_leads ml ON ml.orcamento_id = o.id
LEFT JOIN LATERAL (
  SELECT count(*) AS count FROM propostas_nativas p_1
  WHERE p_1.cliente_id = ml.matched_cliente_id
) p ON true
LEFT JOIN LATERAL (
  SELECT count(*) AS count FROM projetos pr2
  WHERE pr2.cliente_id = ml.matched_cliente_id
) pr_count ON true
LEFT JOIN lead_status ls ON o.status_id = ls.id;

-- 4) RPC: sugerir clientes candidatos para um lead
CREATE OR REPLACE FUNCTION public.suggest_cliente_for_lead(p_lead_id uuid)
RETURNS TABLE (
  cliente_id uuid,
  nome text,
  telefone text,
  telefone_normalized text,
  email text,
  cidade text,
  estado text,
  external_source text,
  external_id text,
  projeto_count bigint,
  match_score real,
  match_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_lead RECORD;
BEGIN
  SELECT l.id, l.nome, l.telefone_normalized, l.email, l.cidade, l.estado, l.tenant_id
    INTO v_lead
  FROM public.leads l
  WHERE l.id = p_lead_id AND l.tenant_id = v_tenant;

  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'lead não encontrado ou fora do tenant';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT c.*,
      similarity(lower(unaccent(coalesce(c.nome,''))), lower(unaccent(coalesce(v_lead.nome,'')))) AS name_sim,
      CASE WHEN c.telefone_normalized IS NOT NULL AND v_lead.telefone_normalized IS NOT NULL
           AND right(c.telefone_normalized, 8) = right(v_lead.telefone_normalized, 8)
           THEN true ELSE false END AS phone_close,
      CASE WHEN c.email IS NOT NULL AND v_lead.email IS NOT NULL
           AND lower(c.email) = lower(v_lead.email) THEN true ELSE false END AS email_match,
      CASE WHEN v_lead.cidade IS NOT NULL AND c.cidade IS NOT NULL
           AND lower(unaccent(c.cidade)) = lower(unaccent(v_lead.cidade)) THEN true ELSE false END AS city_match
    FROM public.clientes c
    WHERE c.tenant_id = v_tenant
  )
  SELECT
    b.id,
    b.nome,
    b.telefone,
    b.telefone_normalized,
    b.email,
    b.cidade,
    b.estado,
    b.external_source,
    b.external_id,
    (SELECT count(*) FROM public.projetos pr WHERE pr.cliente_id = b.id),
    (b.name_sim
       + CASE WHEN b.phone_close THEN 0.4 ELSE 0 END
       + CASE WHEN b.email_match THEN 0.5 ELSE 0 END
       + CASE WHEN b.city_match  THEN 0.15 ELSE 0 END
    )::real AS match_score,
    CONCAT_WS(' · ',
      CASE WHEN b.name_sim >= 0.4 THEN 'nome ('||round(b.name_sim::numeric,2)||')' END,
      CASE WHEN b.phone_close THEN 'telefone parecido' END,
      CASE WHEN b.email_match THEN 'email igual' END,
      CASE WHEN b.city_match THEN 'mesma cidade' END
    )
  FROM base b
  WHERE b.name_sim >= 0.35 OR b.phone_close OR b.email_match
  ORDER BY match_score DESC NULLS LAST, b.nome
  LIMIT 8;
END;
$$;

-- 5) RPC: criar/atualizar vínculo manual
CREATE OR REPLACE FUNCTION public.link_lead_to_cliente(
  p_lead_id uuid,
  p_cliente_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_lead_tenant uuid;
  v_cliente_tenant uuid;
  v_link_id uuid;
BEGIN
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant não resolvido';
  END IF;

  SELECT tenant_id INTO v_lead_tenant FROM public.leads WHERE id = p_lead_id;
  SELECT tenant_id INTO v_cliente_tenant FROM public.clientes WHERE id = p_cliente_id;

  IF v_lead_tenant IS DISTINCT FROM v_tenant OR v_cliente_tenant IS DISTINCT FROM v_tenant THEN
    RAISE EXCEPTION 'lead ou cliente não pertencem ao tenant atual';
  END IF;

  INSERT INTO public.lead_cliente_links (tenant_id, lead_id, cliente_id, reason, linked_by)
  VALUES (v_tenant, p_lead_id, p_cliente_id, p_reason, auth.uid())
  ON CONFLICT (lead_id) DO UPDATE
    SET cliente_id = EXCLUDED.cliente_id,
        reason = EXCLUDED.reason,
        linked_by = EXCLUDED.linked_by,
        linked_at = now(),
        updated_at = now()
  RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$$;

-- 6) RPC: remover vínculo manual
CREATE OR REPLACE FUNCTION public.unlink_lead_cliente(p_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := public.current_tenant_id();
  v_deleted int;
BEGIN
  DELETE FROM public.lead_cliente_links
   WHERE lead_id = p_lead_id AND tenant_id = v_tenant;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_cliente_for_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_lead_to_cliente(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_lead_cliente(uuid) TO authenticated;
