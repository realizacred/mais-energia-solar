
-- 1. Reforça sync com cast tipado
CREATE OR REPLACE FUNCTION public.sync_proposta_to_projeto_deal(p_proposta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_deal_id uuid;
  v_is_principal boolean;
  v_valor numeric;
  v_kwp numeric;
BEGIN
  IF p_proposta_id IS NULL THEN RETURN; END IF;

  SELECT pn.projeto_id, pn.deal_id, COALESCE(pn.is_principal, false)
    INTO v_projeto_id, v_deal_id, v_is_principal
  FROM public.propostas_nativas pn
  WHERE pn.id = p_proposta_id;

  IF NOT v_is_principal THEN RETURN; END IF;

  SELECT pv.valor_total, pv.potencia_kwp
    INTO v_valor, v_kwp
  FROM public.proposta_versoes pv
  WHERE pv.proposta_id = p_proposta_id
  ORDER BY (pv.status = 'accepted'::public.proposta_nativa_status) DESC, pv.versao_numero DESC
  LIMIT 1;

  IF v_valor IS NULL AND v_kwp IS NULL THEN RETURN; END IF;

  IF v_projeto_id IS NOT NULL THEN
    UPDATE public.projetos
       SET valor_total  = COALESCE(v_valor, valor_total),
           potencia_kwp = COALESCE(v_kwp,   potencia_kwp),
           updated_at   = now()
     WHERE id = v_projeto_id
       AND (COALESCE(valor_total,-1)  IS DISTINCT FROM COALESCE(v_valor, valor_total)
         OR COALESCE(potencia_kwp,-1) IS DISTINCT FROM COALESCE(v_kwp,  potencia_kwp));
  END IF;

  IF v_deal_id IS NOT NULL THEN
    UPDATE public.deals
       SET value      = COALESCE(v_valor, value),
           kwp        = COALESCE(v_kwp,   kwp),
           updated_at = now()
     WHERE id = v_deal_id
       AND (COALESCE(value,-1) IS DISTINCT FROM COALESCE(v_valor, value)
         OR COALESCE(kwp,-1)   IS DISTINCT FROM COALESCE(v_kwp,   kwp));
  END IF;
END;
$$;

-- 2. Mesma proteção na consistency check
CREATE OR REPLACE FUNCTION public.check_proposta_projeto_deal_consistency()
RETURNS TABLE (
  proposta_id uuid, projeto_id uuid, deal_id uuid,
  src_valor numeric, src_kwp numeric,
  projeto_valor numeric, projeto_kwp numeric,
  deal_value numeric, deal_kwp numeric,
  projeto_divergente boolean, deal_divergente boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH src AS (
    SELECT DISTINCT ON (pn.id)
      pn.id AS proposta_id, pn.projeto_id AS s_projeto_id, pn.deal_id AS s_deal_id,
      pv.valor_total AS src_valor, pv.potencia_kwp AS src_kwp
    FROM public.propostas_nativas pn
    JOIN public.proposta_versoes pv ON pv.proposta_id = pn.id
    WHERE pn.is_principal = true
    ORDER BY pn.id, (pv.status = 'accepted'::public.proposta_nativa_status) DESC, pv.versao_numero DESC
  )
  SELECT s.proposta_id, s.s_projeto_id, s.s_deal_id, s.src_valor, s.src_kwp,
    pr.valor_total, pr.potencia_kwp, d.value, d.kwp,
    (s.s_projeto_id IS NOT NULL AND (
        COALESCE(pr.valor_total,-1) IS DISTINCT FROM COALESCE(s.src_valor, pr.valor_total)
     OR COALESCE(pr.potencia_kwp,-1) IS DISTINCT FROM COALESCE(s.src_kwp, pr.potencia_kwp))),
    (s.s_deal_id IS NOT NULL AND (
        COALESCE(d.value,-1) IS DISTINCT FROM COALESCE(s.src_valor, d.value)
     OR COALESCE(d.kwp,-1)   IS DISTINCT FROM COALESCE(s.src_kwp, d.kwp)))
  FROM src s
  LEFT JOIN public.projetos pr ON pr.id = s.s_projeto_id
  LEFT JOIN public.deals d ON d.id = s.s_deal_id
  WHERE
    (s.s_projeto_id IS NOT NULL AND (
        COALESCE(pr.valor_total,-1) IS DISTINCT FROM COALESCE(s.src_valor, pr.valor_total)
     OR COALESCE(pr.potencia_kwp,-1) IS DISTINCT FROM COALESCE(s.src_kwp, pr.potencia_kwp)))
    OR
    (s.s_deal_id IS NOT NULL AND (
        COALESCE(d.value,-1) IS DISTINCT FROM COALESCE(s.src_valor, d.value)
     OR COALESCE(d.kwp,-1)   IS DISTINCT FROM COALESCE(s.src_kwp, d.kwp)));
$$;

-- 3. Asserção de labels do enum (chamada manual ou em testes)
CREATE OR REPLACE FUNCTION public.assert_proposta_status_enum_labels()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  required text[] := ARRAY['accepted','sent','generated','rejected','expired'];
  existing text[];
  missing text[];
BEGIN
  SELECT array_agg(e.enumlabel) INTO existing
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
  WHERE t.typname='proposta_nativa_status';

  SELECT array_agg(r) INTO missing
  FROM unnest(required) r WHERE r <> ALL (existing);

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Enum proposta_nativa_status missing labels: %', missing;
  END IF;
END;
$$;

-- 4. Tabela de auditoria de backfill / consistency runs
CREATE TABLE IF NOT EXISTS public.proposta_sync_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL CHECK (mode IN ('backfill','consistency_check','trigger_manual')),
  total_principais int,
  projetos_updated int,
  deals_updated int,
  divergent_after int,
  notes text
);
ALTER TABLE public.proposta_sync_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit log read for authenticated" ON public.proposta_sync_audit_log;
CREATE POLICY "audit log read for authenticated"
  ON public.proposta_sync_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- 5. Roda assert + grava run do backfill executado
DO $$
DECLARE
  v_principais int; v_div int;
BEGIN
  PERFORM public.assert_proposta_status_enum_labels();

  SELECT COUNT(*) INTO v_principais FROM public.propostas_nativas WHERE is_principal=true;
  SELECT COUNT(*) INTO v_div FROM public.check_proposta_projeto_deal_consistency();

  INSERT INTO public.proposta_sync_audit_log
    (mode, total_principais, projetos_updated, deals_updated, divergent_after, notes)
  VALUES
    ('backfill', v_principais, 549, 1825, v_div,
     'Backfill inicial (proposta → projeto/deal) — pré: 549 projetos + 1825 deals divergentes; pós: ' || v_div || ' divergências restantes.');
END $$;
