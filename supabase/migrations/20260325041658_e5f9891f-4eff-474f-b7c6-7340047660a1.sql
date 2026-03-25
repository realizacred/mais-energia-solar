
-- Create proposal follow-up queue for commercial automation
CREATE TABLE IF NOT EXISTS public.proposal_followup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  proposta_id uuid NOT NULL REFERENCES propostas_nativas(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- 'viewed_no_response', 'hot_lead', 'not_opened'
  status text NOT NULL DEFAULT 'pendente', -- pendente, processado, ignorado
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (proposta_id, tipo, status)
);

ALTER TABLE public.proposal_followup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for proposal_followup_queue"
  ON public.proposal_followup_queue
  FOR ALL
  TO authenticated
  USING (tenant_id = current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_proposal_followup_queue_status ON proposal_followup_queue(status, tipo);
CREATE INDEX IF NOT EXISTS idx_proposal_followup_queue_tenant ON proposal_followup_queue(tenant_id);

-- RPC for commercial automation: detect follow-up opportunities
CREATE OR REPLACE FUNCTION public.detect_proposal_followups()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count_viewed int := 0;
  v_count_hot int := 0;
  v_count_not_opened int := 0;
  rec record;
BEGIN
  -- 1. Viewed but no response in 24h
  FOR rec IN
    SELECT pn.id, pn.tenant_id, pn.titulo, c.nome as cliente_nome, pv.valor_total
    FROM propostas_nativas pn
    LEFT JOIN clientes c ON c.id = pn.cliente_id
    LEFT JOIN proposta_versoes pv ON pv.proposta_id = pn.id
      AND pv.versao_numero = (SELECT MAX(pv2.versao_numero) FROM proposta_versoes pv2 WHERE pv2.proposta_id = pn.id)
    WHERE pn.status IN ('vista', 'enviada')
      AND pn.primeiro_acesso_em IS NOT NULL
      AND pn.primeiro_acesso_em < now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM proposal_followup_queue pfq
        WHERE pfq.proposta_id = pn.id AND pfq.tipo = 'viewed_no_response'
          AND pfq.status IN ('pendente', 'processado')
      )
  LOOP
    INSERT INTO proposal_followup_queue (tenant_id, proposta_id, tipo, payload)
    VALUES (rec.tenant_id, rec.id, 'viewed_no_response', jsonb_build_object(
      'cliente_nome', rec.cliente_nome, 'titulo', rec.titulo, 'valor_total', rec.valor_total
    ))
    ON CONFLICT DO NOTHING;
    v_count_viewed := v_count_viewed + 1;
  END LOOP;

  -- 2. Hot leads (2+ views, not yet accepted)
  FOR rec IN
    SELECT pn.id, pn.tenant_id, pn.titulo, pn.total_aberturas, c.nome as cliente_nome
    FROM propostas_nativas pn
    LEFT JOIN clientes c ON c.id = pn.cliente_id
    WHERE pn.total_aberturas >= 2
      AND pn.status NOT IN ('aceita', 'recusada', 'cancelada', 'expirada', 'excluida')
      AND NOT EXISTS (
        SELECT 1 FROM proposal_followup_queue pfq
        WHERE pfq.proposta_id = pn.id AND pfq.tipo = 'hot_lead'
          AND pfq.status IN ('pendente', 'processado')
      )
  LOOP
    INSERT INTO proposal_followup_queue (tenant_id, proposta_id, tipo, payload)
    VALUES (rec.tenant_id, rec.id, 'hot_lead', jsonb_build_object(
      'cliente_nome', rec.cliente_nome, 'titulo', rec.titulo, 'total_aberturas', rec.total_aberturas
    ))
    ON CONFLICT DO NOTHING;
    v_count_hot := v_count_hot + 1;
  END LOOP;

  -- 3. Not opened in 48h after send
  FOR rec IN
    SELECT pn.id, pn.tenant_id, pn.titulo, c.nome as cliente_nome
    FROM propostas_nativas pn
    LEFT JOIN clientes c ON c.id = pn.cliente_id
    WHERE pn.status = 'enviada'
      AND pn.primeiro_acesso_em IS NULL
      AND pn.enviada_at IS NOT NULL
      AND pn.enviada_at < now() - interval '48 hours'
      AND NOT EXISTS (
        SELECT 1 FROM proposal_followup_queue pfq
        WHERE pfq.proposta_id = pn.id AND pfq.tipo = 'not_opened'
          AND pfq.status IN ('pendente', 'processado')
      )
  LOOP
    INSERT INTO proposal_followup_queue (tenant_id, proposta_id, tipo, payload)
    VALUES (rec.tenant_id, rec.id, 'not_opened', jsonb_build_object(
      'cliente_nome', rec.cliente_nome, 'titulo', rec.titulo
    ))
    ON CONFLICT DO NOTHING;
    v_count_not_opened := v_count_not_opened + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'viewed_no_response', v_count_viewed,
    'hot_lead', v_count_hot,
    'not_opened', v_count_not_opened,
    'timestamp', now()
  );
END;
$$;
