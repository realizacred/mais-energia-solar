
-- Follow-up por Propostas — Fase A + B + C (ref: RB-76, RB-69, DA-48)

-- Ampliar CHECK de cenario (mantém antigos + 4 novos)
ALTER TABLE public.wa_followup_rules
  DROP CONSTRAINT IF EXISTS wa_followup_rules_cenario_check;

ALTER TABLE public.wa_followup_rules
  ADD CONSTRAINT wa_followup_rules_cenario_check
  CHECK (cenario = ANY (ARRAY[
    'cliente_sem_resposta','equipe_sem_resposta','conversa_parada',
    'proposta_enviada_sem_visualizacao',
    'proposta_visualizada_sem_decisao',
    'proposta_prestes_a_expirar',
    'proposta_aceita_sem_avanco'
  ]));

-- Fase A.1 — wa_followup_queue
ALTER TABLE public.wa_followup_queue
  ADD COLUMN IF NOT EXISTS proposta_id uuid NULL,
  ADD COLUMN IF NOT EXISTS versao_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS cenario     text NULL,
  ADD COLUMN IF NOT EXISTS proposal_context jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_wa_followup_queue_proposta
  ON public.wa_followup_queue (tenant_id, proposta_id)
  WHERE proposta_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_followup_queue_cenario
  ON public.wa_followup_queue (tenant_id, cenario, status)
  WHERE cenario IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_followup_queue_proposta_idempotent
  ON public.wa_followup_queue (proposta_id, rule_id, tentativa)
  WHERE proposta_id IS NOT NULL
    AND status = ANY (ARRAY['pendente'::text, 'pendente_revisao'::text, 'enviado'::text]);

-- Fase A.2 — wa_followup_logs
ALTER TABLE public.wa_followup_logs
  ADD COLUMN IF NOT EXISTS proposta_id uuid NULL,
  ADD COLUMN IF NOT EXISTS versao_id   uuid NULL,
  ADD COLUMN IF NOT EXISTS proposal_context jsonb NULL;

CREATE INDEX IF NOT EXISTS idx_wa_followup_logs_proposta
  ON public.wa_followup_logs (tenant_id, proposta_id, created_at DESC)
  WHERE proposta_id IS NOT NULL;

-- Fase A.3 — wa_followup_rules: config híbrida
ALTER TABLE public.wa_followup_rules
  ADD COLUMN IF NOT EXISTS cooldown_horas integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS precisa_revisao_humana boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS usar_ia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.wa_followup_rules.config IS
'Config flexível: horario_inicio, horario_fim, dias_semana, prompt_ia, fallback_template, '
'status_proposta_incluidos, status_proposta_bloqueados, timezone, delay_hours.';

-- Fase B — Seed regras de proposta (ativo=false, revisão humana obrigatória)
INSERT INTO public.wa_followup_rules (
  tenant_id, nome, descricao, cenario, prazo_minutos, prioridade,
  envio_automatico, max_tentativas, ativo, ordem,
  cooldown_horas, precisa_revisao_humana, usar_ia, config
)
SELECT
  t.id,
  c.nome, c.descricao, c.cenario, c.prazo_minutos, 'media'::text,
  false, c.max_tentativas, false, c.ordem,
  c.cooldown_horas, true, true,
  jsonb_build_object(
    'fallback_template', c.fallback_template,
    'prompt_ia', c.prompt_ia,
    'status_proposta_incluidos', c.status_incluidos,
    'status_proposta_bloqueados', ARRAY['aceita','recusada','expirada','cancelada']::text[],
    'timezone', 'America/Sao_Paulo',
    'horario_inicio', '09:00',
    'horario_fim', '18:00',
    'dias_semana', ARRAY[1,2,3,4,5]::int[]
  )
FROM public.tenants t
CROSS JOIN (VALUES
  ('Proposta enviada sem visualização',
   'Cliente recebeu a proposta mas ainda não abriu. Lembrete cordial.',
   'proposta_enviada_sem_visualizacao', 2880, 3, 100, 24,
   'Olá {{cliente_nome}}, tudo bem? Enviei sua proposta solar há alguns dias. Se precisar de ajuda para visualizar, estou à disposição.',
   'Gere mensagem curta convidando o cliente a abrir a proposta. Sem valores.',
   ARRAY['enviada']::text[]),
  ('Proposta visualizada sem decisão',
   'Cliente já abriu mas ainda não respondeu. Oferecer ajuda.',
   'proposta_visualizada_sem_decisao', 1440, 3, 101, 48,
   'Oi {{cliente_nome}}, vi que você abriu a proposta. Posso esclarecer alguma dúvida?',
   'Gere mensagem oferecendo esclarecimento de dúvidas. Sem pressão. Sem inventar condições.',
   ARRAY['enviada','visualizada']::text[]),
  ('Proposta prestes a expirar',
   'Validade próxima do fim. Avisar com educação.',
   'proposta_prestes_a_expirar', 4320, 2, 102, 72,
   'Olá {{cliente_nome}}, sua proposta está perto da validade. Posso ajudar com qualquer coisa antes disso?',
   'Gere mensagem curta avisando da validade. Sem números novos. Sem pressão.',
   ARRAY['enviada','visualizada']::text[]),
  ('Proposta aceita sem avanço operacional',
   'Alerta interno — cliente aceitou mas projeto não avançou.',
   'proposta_aceita_sem_avanco', 2880, 1, 103, 168,
   '[ALERTA INTERNO] Proposta aceita há mais de 2 dias sem avanço. Verificar com consultor.',
   'Apenas gerar resumo interno. NÃO enviar ao cliente.',
   ARRAY['aceita']::text[])
) AS c(nome, descricao, cenario, prazo_minutos, max_tentativas, ordem, cooldown_horas,
       fallback_template, prompt_ia, status_incluidos)
WHERE NOT EXISTS (
  SELECT 1 FROM public.wa_followup_rules r
  WHERE r.tenant_id = t.id AND r.cenario = c.cenario
);

-- Fase C — RPC: candidatos por proposta (apenas SELECT; sem envio)
CREATE OR REPLACE FUNCTION public.claim_proposal_followup_candidates(_limit integer DEFAULT 100)
RETURNS TABLE (
  proposta_id uuid,
  versao_id uuid,
  rule_id uuid,
  tenant_id uuid,
  cenario text,
  cliente_id uuid,
  cliente_nome text,
  cliente_telefone text,
  projeto_id uuid,
  deal_id uuid,
  consultor_id uuid,
  status_proposta text,
  enviada_at timestamptz,
  viewed_at timestamptz,
  valido_ate date,
  valor_total numeric,
  potencia_kwp numeric,
  economia_mensal numeric,
  payback_meses integer,
  attempt_count bigint,
  max_tentativas integer,
  precisa_revisao_humana boolean,
  usar_ia boolean,
  fallback_template text,
  prompt_ia text,
  cooldown_horas integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH active_rules AS (
  SELECT r.id, r.tenant_id, r.cenario, r.prazo_minutos, r.max_tentativas,
         r.cooldown_horas, r.precisa_revisao_humana, r.usar_ia,
         COALESCE(r.config->>'fallback_template', r.mensagem_template) AS fallback_template,
         COALESCE(r.config->>'prompt_ia', '') AS prompt_ia,
         COALESCE(
           ARRAY(SELECT jsonb_array_elements_text(r.config->'status_proposta_incluidos')),
           ARRAY[]::text[]
         ) AS status_incluidos,
         COALESCE(
           ARRAY(SELECT jsonb_array_elements_text(r.config->'status_proposta_bloqueados')),
           ARRAY['aceita','recusada','expirada','cancelada']::text[]
         ) AS status_bloqueados
  FROM wa_followup_rules r
  WHERE r.ativo = true
    AND r.cenario LIKE 'proposta\_%' ESCAPE '\'
),
candidatos AS (
  SELECT
    pn.id AS proposta_id,
    pv.id AS versao_id,
    ar.id AS rule_id,
    ar.tenant_id,
    ar.cenario,
    pn.cliente_id,
    pn.projeto_id,
    pn.deal_id,
    pn.consultor_id,
    pn.status AS status_proposta,
    pn.enviada_at,
    pv.viewed_at,
    pv.valido_ate,
    pv.valor_total,
    pv.potencia_kwp,
    pv.economia_mensal,
    pv.payback_meses,
    ar.max_tentativas,
    ar.precisa_revisao_humana,
    ar.usar_ia,
    ar.fallback_template,
    ar.prompt_ia,
    ar.cooldown_horas,
    ar.prazo_minutos,
    ar.status_bloqueados
  FROM propostas_nativas pn
  JOIN proposta_versoes pv
    ON pv.proposta_id = pn.id AND pv.versao_numero = pn.versao_atual
  JOIN active_rules ar
    ON ar.tenant_id = pn.tenant_id
   AND (cardinality(ar.status_incluidos) = 0 OR pn.status = ANY(ar.status_incluidos))
   AND NOT (pn.status = ANY(ar.status_bloqueados))
  WHERE pn.deleted_at IS NULL
    AND pn.enviada_at IS NOT NULL
    AND (
      (ar.cenario = 'proposta_enviada_sem_visualizacao'
       AND pv.viewed_at IS NULL
       AND pn.enviada_at < now() - (ar.prazo_minutos || ' minutes')::interval)
      OR
      (ar.cenario = 'proposta_visualizada_sem_decisao'
       AND pv.viewed_at IS NOT NULL
       AND pn.aceita_at IS NULL AND pn.recusada_at IS NULL
       AND pv.viewed_at < now() - (ar.prazo_minutos || ' minutes')::interval)
      OR
      (ar.cenario = 'proposta_prestes_a_expirar'
       AND pv.valido_ate IS NOT NULL
       AND pn.aceita_at IS NULL AND pn.recusada_at IS NULL
       AND pv.valido_ate <= (current_date + interval '3 days')
       AND pv.valido_ate >= current_date)
      OR
      (ar.cenario = 'proposta_aceita_sem_avanco'
       AND pn.aceita_at IS NOT NULL
       AND pn.aceita_at < now() - (ar.prazo_minutos || ' minutes')::interval)
    )
),
deduped AS (
  SELECT c.*
  FROM candidatos c
  WHERE NOT EXISTS (
    SELECT 1 FROM wa_followup_queue fq
    WHERE fq.proposta_id = c.proposta_id
      AND fq.rule_id = c.rule_id
      AND (
        fq.status IN ('pendente','pendente_revisao')
        OR (fq.status IN ('enviado','aprovado')
            AND fq.sent_at > now() - (c.cooldown_horas || ' hours')::interval)
      )
  )
),
with_attempts AS (
  SELECT d.*, COALESCE(ac.cnt, 0) AS attempt_count
  FROM deduped d
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM wa_followup_queue fq
    WHERE fq.proposta_id = d.proposta_id
      AND fq.rule_id = d.rule_id
      AND fq.status IN ('enviado','aprovado','respondido')
  ) ac ON true
  WHERE COALESCE(ac.cnt, 0) < d.max_tentativas
),
with_cliente AS (
  SELECT w.*, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone
  FROM with_attempts w
  LEFT JOIN clientes cl ON cl.id = w.cliente_id
)
SELECT
  proposta_id, versao_id, rule_id, tenant_id, cenario,
  cliente_id, cliente_nome, cliente_telefone,
  projeto_id, deal_id, consultor_id,
  status_proposta, enviada_at, viewed_at, valido_ate,
  valor_total, potencia_kwp, economia_mensal, payback_meses,
  attempt_count, max_tentativas, precisa_revisao_humana, usar_ia,
  fallback_template, prompt_ia, cooldown_horas
FROM with_cliente
ORDER BY enviada_at ASC NULLS LAST
LIMIT _limit;
$$;

COMMENT ON FUNCTION public.claim_proposal_followup_candidates IS
'Fase C — Lista propostas elegíveis para follow-up, sem inserir nada. '
'Usado por process-wa-followups (ou UI) para popular wa_followup_queue com status=pendente_revisao. '
'Dedup por proposta_id + rule_id respeitando cooldown_horas. Envio automático desligado por padrão.';
