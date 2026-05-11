-- Fix vw_proposal_followup_inbox: use real commercial activity dates instead of migration timestamps
-- Keeps SECURITY INVOKER (default) preserving RLS. No data mutation.

CREATE OR REPLACE VIEW public.vw_proposal_followup_inbox
WITH (security_invoker = true)
AS
SELECT p.id AS proposta_id,
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
    -- Real commercial activity: prefer real signals; fall back to SM original date for imported records,
    -- never to the CRM migration timestamp.
    GREATEST(
      COALESCE(p.enviada_at,         '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(p.ultimo_acesso_em,   '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(v.viewed_at,          '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(v.enviado_em,         '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(last_att.sent_at,     '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(
        p.enviada_at, p.ultimo_acesso_em, v.viewed_at, v.enviado_em, last_att.sent_at,
        CASE
          WHEN p.external_source = 'solarmarket'
            THEN COALESCE(sm_orig.sm_created_at, p.created_at)
          ELSE p.created_at
        END
      )
    ) AS ultima_atividade_em,
    EXTRACT(epoch FROM now() - GREATEST(
      COALESCE(p.enviada_at,         '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(p.ultimo_acesso_em,   '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(v.viewed_at,          '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(v.enviado_em,         '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(last_att.sent_at,     '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(
        p.enviada_at, p.ultimo_acesso_em, v.viewed_at, v.enviado_em, last_att.sent_at,
        CASE
          WHEN p.external_source = 'solarmarket'
            THEN COALESCE(sm_orig.sm_created_at, p.created_at)
          ELSE p.created_at
        END
      )
    )) / 86400.0 AS dias_parado,
    CASE
        WHEN p.aceita_at IS NOT NULL OR p.recusada_at IS NOT NULL THEN 'fechado'
        WHEN p.enviada_at IS NULL AND v.enviado_em IS NULL THEN 'rascunho'
        WHEN p.ultimo_acesso_em IS NULL AND v.viewed_at IS NULL
             AND COALESCE(p.enviada_at, v.enviado_em) < (now() - interval '3 days') THEN 'enviada_sem_view'
        WHEN COALESCE(p.ultimo_acesso_em, v.viewed_at) < (now() - interval '7 days') THEN 'view_sem_resposta'
        WHEN last_att.sent_at IS NOT NULL AND last_att.client_response_at IS NULL
             AND last_att.sent_at < (now() - interval '3 days') THEN 'followup_sem_resposta'
        ELSE 'monitorar'
    END AS classe_followup,
    COALESCE(mem.temperatura, 'morno') AS temperatura,
    COALESCE(mem.score_recuperacao, 50::numeric) AS score_ia,
    mem.proxima_acao_sugerida AS sugestao_ia,
    mem.objecao_principal,
    mem.proxima_acao_em,
    COALESCE(att_count.n, 0) AS qtd_followups,
    last_att.message_text AS ultima_mensagem,
    last_att.channel AS ultimo_canal,
    last_att.outcome AS ultimo_outcome,
    last_att.sent_at AS ultimo_followup_em,
    lock.locked_until AS bloqueado_ate,
    p.projeto_id
FROM propostas_nativas p
LEFT JOIN LATERAL (
  SELECT pv.*
  FROM proposta_versoes pv
  WHERE pv.proposta_id = p.id
  ORDER BY pv.versao_numero DESC
  LIMIT 1
) v ON true
LEFT JOIN clientes c ON c.id = p.cliente_id
LEFT JOIN proposal_commercial_memory mem ON mem.proposta_id = p.id
LEFT JOIN LATERAL (
  SELECT a.sent_at, a.message_text, a.channel, a.outcome, a.client_response_at
  FROM proposal_followup_attempts a
  WHERE a.proposta_id = p.id AND a.sent_at IS NOT NULL
  ORDER BY a.sent_at DESC
  LIMIT 1
) last_att ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS n
  FROM proposal_followup_attempts a
  WHERE a.proposta_id = p.id AND a.sent_at IS NOT NULL
) att_count ON true
LEFT JOIN LATERAL (
  SELECT max(l.locked_until) AS locked_until
  FROM proposal_followup_locks l
  WHERE l.proposta_id = p.id AND l.locked_until > now()
) lock ON true
-- SolarMarket original commercial date fallback (never the CRM migration timestamp)
LEFT JOIN LATERAL (
  SELECT (sr.payload->>'createdAt')::timestamptz AS sm_created_at
  FROM sm_projetos_raw sr
  WHERE p.external_source = 'solarmarket'
    AND sr.tenant_id = p.tenant_id
    AND sr.payload->>'id' = p.external_id
  LIMIT 1
) sm_orig ON true
WHERE p.deleted_at IS NULL
  AND p.status <> ALL (ARRAY['aceita','recusada','expirada','rascunho']);