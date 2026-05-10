
-- =========================================================================
-- FASE 0 — /admin/followup-comercial — Fundamentos
-- =========================================================================

-- 1) proposal_followup_attempts ------------------------------------------
CREATE TABLE public.proposal_followup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  proposta_id uuid NOT NULL REFERENCES public.propostas_nativas(id) ON DELETE CASCADE,
  versao_id uuid NULL REFERENCES public.proposta_versoes(id) ON DELETE SET NULL,
  consultor_id uuid NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','manual_note','sms')),
  mode text NOT NULL CHECK (mode IN ('manual','semi_auto','auto')),
  template_id uuid NULL,
  message_text text NULL,
  ai_generated boolean NOT NULL DEFAULT false,
  ai_model text NULL,
  ai_prompt_id uuid NULL,
  scheduled_for timestamptz NULL,
  sent_at timestamptz NULL,
  delivery_status text NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued','sent','delivered','read','failed','skipped','cancelled')),
  delivery_error text NULL,
  client_response_at timestamptz NULL,
  outcome text NULL
    CHECK (outcome IN ('no_reply','reply_positive','reply_negative','reopened','converted','lost')),
  approved_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pfa_tenant_proposta ON public.proposal_followup_attempts(tenant_id, proposta_id, sent_at DESC);
CREATE INDEX idx_pfa_consultor ON public.proposal_followup_attempts(consultor_id, sent_at DESC);
CREATE INDEX idx_pfa_status ON public.proposal_followup_attempts(tenant_id, delivery_status) WHERE delivery_status IN ('queued','sent');

ALTER TABLE public.proposal_followup_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY pfa_select ON public.proposal_followup_attempts FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pfa_insert ON public.proposal_followup_attempts FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pfa_update ON public.proposal_followup_attempts FOR UPDATE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

-- 2) proposal_followup_locks ----------------------------------------------
CREATE TABLE public.proposal_followup_locks (
  proposta_id uuid NOT NULL REFERENCES public.propostas_nativas(id) ON DELETE CASCADE,
  channel text NOT NULL,
  tenant_id uuid NOT NULL,
  locked_until timestamptz NOT NULL,
  reason text NULL,
  last_message_hash text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (proposta_id, channel)
);
CREATE INDEX idx_pfl_tenant ON public.proposal_followup_locks(tenant_id, locked_until);

ALTER TABLE public.proposal_followup_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY pfl_select ON public.proposal_followup_locks FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pfl_insert ON public.proposal_followup_locks FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pfl_update ON public.proposal_followup_locks FOR UPDATE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

-- 3) proposal_commercial_memory -------------------------------------------
CREATE TABLE public.proposal_commercial_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  proposta_id uuid NOT NULL UNIQUE REFERENCES public.propostas_nativas(id) ON DELETE CASCADE,
  objecao_principal text NULL,
  temperatura text NOT NULL DEFAULT 'morno'
    CHECK (temperatura IN ('quente','morno','frio','congelado')),
  score_recuperacao numeric(5,2) NOT NULL DEFAULT 50
    CHECK (score_recuperacao BETWEEN 0 AND 100),
  ultima_justificativa text NULL,
  proxima_acao_sugerida text NULL,
  proxima_acao_em timestamptz NULL,
  notas_ia jsonb NOT NULL DEFAULT '{}'::jsonb,
  classified_at timestamptz NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pcm_tenant ON public.proposal_commercial_memory(tenant_id, temperatura, score_recuperacao DESC);

ALTER TABLE public.proposal_commercial_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcm_select ON public.proposal_commercial_memory FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pcm_insert ON public.proposal_commercial_memory FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pcm_update ON public.proposal_commercial_memory FOR UPDATE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

-- 4) proposal_communication_optout ----------------------------------------
CREATE TABLE public.proposal_communication_optout (
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  channel text NOT NULL,
  category text NOT NULL DEFAULT 'commercial_followup',
  tenant_id uuid NOT NULL,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  reason text NULL,
  created_by uuid NULL,
  PRIMARY KEY (cliente_id, channel, category)
);
CREATE INDEX idx_pco_tenant ON public.proposal_communication_optout(tenant_id);

ALTER TABLE public.proposal_communication_optout ENABLE ROW LEVEL SECURITY;

CREATE POLICY pco_select ON public.proposal_communication_optout FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pco_insert ON public.proposal_communication_optout FOR INSERT TO authenticated
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pco_delete ON public.proposal_communication_optout FOR DELETE TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

-- 5) proposal_followup_cadence_rules --------------------------------------
CREATE TABLE public.proposal_followup_cadence_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text NULL,
  active boolean NOT NULL DEFAULT false,
  trigger_after_days integer NOT NULL CHECK (trigger_after_days >= 1),
  required_status text[] NOT NULL DEFAULT ARRAY['enviada']::text[],
  excluded_status text[] NOT NULL DEFAULT ARRAY['aceita','recusada','expirada']::text[],
  channel text NOT NULL DEFAULT 'whatsapp',
  mode text NOT NULL DEFAULT 'semi_auto'
    CHECK (mode IN ('manual','semi_auto','auto')),
  template_id uuid NULL,
  ai_enabled boolean NOT NULL DEFAULT false,
  daily_cap integer NOT NULL DEFAULT 30,
  hour_window jsonb NOT NULL DEFAULT '{"start":9,"end":18,"tz":"America/Sao_Paulo"}'::jsonb,
  weekday_mask integer NOT NULL DEFAULT 31, -- seg-sex
  max_attempts integer NOT NULL DEFAULT 3,
  cooldown_hours integer NOT NULL DEFAULT 48,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pfcr_tenant_active ON public.proposal_followup_cadence_rules(tenant_id, active);

ALTER TABLE public.proposal_followup_cadence_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY pfcr_select ON public.proposal_followup_cadence_rules FOR SELECT TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));
CREATE POLICY pfcr_all ON public.proposal_followup_cadence_rules FOR ALL TO authenticated
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

-- 6) updated_at triggers --------------------------------------------------
CREATE TRIGGER trg_pfa_updated_at BEFORE UPDATE ON public.proposal_followup_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pfl_updated_at BEFORE UPDATE ON public.proposal_followup_locks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pcm_updated_at BEFORE UPDATE ON public.proposal_commercial_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pfcr_updated_at BEFORE UPDATE ON public.proposal_followup_cadence_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Índices auxiliares na propostas_nativas ------------------------------
CREATE INDEX IF NOT EXISTS idx_pn_followup_inbox
  ON public.propostas_nativas(tenant_id, status, ultimo_acesso_em)
  WHERE deleted_at IS NULL AND status NOT IN ('aceita','recusada','expirada');

-- 8) View canônica vw_proposal_followup_inbox -----------------------------
CREATE OR REPLACE VIEW public.vw_proposal_followup_inbox
WITH (security_invoker = true) AS
SELECT
  p.id AS proposta_id,
  p.tenant_id,
  p.consultor_id,
  p.cliente_id,
  p.lead_id,
  p.deal_id,
  p.codigo,
  p.titulo,
  p.status,
  p.is_principal,
  p.enviada_at,
  p.aceita_at,
  p.recusada_at,
  p.primeiro_acesso_em,
  p.ultimo_acesso_em,
  COALESCE(p.total_aberturas, 0) AS total_aberturas,
  p.status_visualizacao,
  v.id AS versao_id,
  v.versao_numero,
  v.valor_total,
  v.potencia_kwp,
  v.valido_ate,
  v.viewed_at AS versao_viewed_at,
  c.nome AS cliente_nome,
  c.telefone_normalized,
  c.email AS cliente_email,
  GREATEST(
    COALESCE(p.enviada_at, p.created_at),
    COALESCE(p.ultimo_acesso_em, '1970-01-01'::timestamptz),
    COALESCE(last_att.sent_at, '1970-01-01'::timestamptz)
  ) AS ultima_atividade_em,
  EXTRACT(EPOCH FROM (now() - GREATEST(
    COALESCE(p.enviada_at, p.created_at),
    COALESCE(p.ultimo_acesso_em, '1970-01-01'::timestamptz),
    COALESCE(last_att.sent_at, '1970-01-01'::timestamptz)
  ))) / 86400.0 AS dias_parado,
  CASE
    WHEN p.aceita_at IS NOT NULL OR p.recusada_at IS NOT NULL THEN 'fechado'
    WHEN p.enviada_at IS NULL THEN 'rascunho'
    WHEN p.ultimo_acesso_em IS NULL AND p.enviada_at < (now() - interval '3 days') THEN 'enviada_sem_view'
    WHEN p.ultimo_acesso_em IS NOT NULL AND p.ultimo_acesso_em < (now() - interval '7 days') THEN 'view_sem_resposta'
    WHEN last_att.sent_at IS NOT NULL AND last_att.client_response_at IS NULL
         AND last_att.sent_at < (now() - interval '3 days') THEN 'followup_sem_resposta'
    ELSE 'monitorar'
  END AS classe_followup,
  COALESCE(mem.temperatura, 'morno') AS temperatura,
  COALESCE(mem.score_recuperacao, 50) AS score_ia,
  mem.proxima_acao_sugerida AS sugestao_ia,
  mem.objecao_principal,
  mem.proxima_acao_em,
  COALESCE(att_count.n, 0) AS qtd_followups,
  last_att.message_text AS ultima_mensagem,
  last_att.channel AS ultimo_canal,
  last_att.outcome AS ultimo_outcome,
  last_att.sent_at AS ultimo_followup_em,
  lock.locked_until AS bloqueado_ate
FROM public.propostas_nativas p
LEFT JOIN LATERAL (
  SELECT pv.* FROM public.proposta_versoes pv
  WHERE pv.proposta_id = p.id
  ORDER BY pv.versao_numero DESC LIMIT 1
) v ON true
LEFT JOIN public.clientes c ON c.id = p.cliente_id
LEFT JOIN public.proposal_commercial_memory mem ON mem.proposta_id = p.id
LEFT JOIN LATERAL (
  SELECT a.sent_at, a.message_text, a.channel, a.outcome, a.client_response_at
  FROM public.proposal_followup_attempts a
  WHERE a.proposta_id = p.id AND a.sent_at IS NOT NULL
  ORDER BY a.sent_at DESC LIMIT 1
) last_att ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS n
  FROM public.proposal_followup_attempts a
  WHERE a.proposta_id = p.id AND a.sent_at IS NOT NULL
) att_count ON true
LEFT JOIN LATERAL (
  SELECT max(l.locked_until) AS locked_until
  FROM public.proposal_followup_locks l
  WHERE l.proposta_id = p.id AND l.locked_until > now()
) lock ON true
WHERE p.deleted_at IS NULL
  AND p.status NOT IN ('aceita','recusada','expirada','rascunho');

-- 9) RPC: get_followup_kpis -----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_followup_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid := ((auth.jwt() ->> 'tenant_id')::uuid);
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_em_aberto', count(*),
    'sem_resposta', count(*) FILTER (WHERE classe_followup IN ('enviada_sem_view','view_sem_resposta','followup_sem_resposta')),
    'visualizadas_sem_retorno', count(*) FILTER (WHERE classe_followup = 'view_sem_resposta'),
    'esquecidas_30d', count(*) FILTER (WHERE dias_parado >= 30 AND dias_parado < 60),
    'esquecidas_60d', count(*) FILTER (WHERE dias_parado >= 60 AND dias_parado < 90),
    'esquecidas_90d', count(*) FILTER (WHERE dias_parado >= 90),
    'quentes', count(*) FILTER (WHERE temperatura = 'quente'),
    'frias', count(*) FILTER (WHERE temperatura IN ('frio','congelado')),
    'followups_pendentes', count(*) FILTER (WHERE proxima_acao_em IS NOT NULL AND proxima_acao_em <= now()),
    'recuperadas_30d', (
      SELECT count(*) FROM public.proposal_followup_attempts a
      WHERE a.tenant_id = v_tenant
        AND a.outcome IN ('reply_positive','reopened','converted')
        AND a.sent_at >= now() - interval '30 days'
    )
  )
  INTO v_result
  FROM public.vw_proposal_followup_inbox
  WHERE tenant_id = v_tenant;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_followup_kpis() TO authenticated;
