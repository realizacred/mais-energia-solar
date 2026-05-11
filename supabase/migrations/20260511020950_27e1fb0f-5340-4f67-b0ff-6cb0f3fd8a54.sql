CREATE OR REPLACE VIEW public.vw_proposal_followup_inbox AS
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
    GREATEST(COALESCE(p.enviada_at, p.created_at), COALESCE(p.ultimo_acesso_em, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(last_att.sent_at, '1970-01-01 00:00:00+00'::timestamptz)) AS ultima_atividade_em,
    EXTRACT(epoch FROM now() - GREATEST(COALESCE(p.enviada_at, p.created_at), COALESCE(p.ultimo_acesso_em, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(last_att.sent_at, '1970-01-01 00:00:00+00'::timestamptz))) / 86400.0 AS dias_parado,
    CASE
        WHEN p.aceita_at IS NOT NULL OR p.recusada_at IS NOT NULL THEN 'fechado'
        WHEN p.enviada_at IS NULL THEN 'rascunho'
        WHEN p.ultimo_acesso_em IS NULL AND p.enviada_at < (now() - interval '3 days') THEN 'enviada_sem_view'
        WHEN p.ultimo_acesso_em IS NOT NULL AND p.ultimo_acesso_em < (now() - interval '7 days') THEN 'view_sem_resposta'
        WHEN last_att.sent_at IS NOT NULL AND last_att.client_response_at IS NULL AND last_att.sent_at < (now() - interval '3 days') THEN 'followup_sem_resposta'
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
    p.projeto_id AS projeto_id
FROM propostas_nativas p
LEFT JOIN LATERAL (
    SELECT pv.* FROM proposta_versoes pv
    WHERE pv.proposta_id = p.id
    ORDER BY pv.versao_numero DESC LIMIT 1
) v ON true
LEFT JOIN clientes c ON c.id = p.cliente_id
LEFT JOIN proposal_commercial_memory mem ON mem.proposta_id = p.id
LEFT JOIN LATERAL (
    SELECT a.sent_at, a.message_text, a.channel, a.outcome, a.client_response_at
    FROM proposal_followup_attempts a
    WHERE a.proposta_id = p.id AND a.sent_at IS NOT NULL
    ORDER BY a.sent_at DESC LIMIT 1
) last_att ON true
LEFT JOIN LATERAL (
    SELECT count(*)::integer AS n FROM proposal_followup_attempts a
    WHERE a.proposta_id = p.id AND a.sent_at IS NOT NULL
) att_count ON true
LEFT JOIN LATERAL (
    SELECT max(l.locked_until) AS locked_until FROM proposal_followup_locks l
    WHERE l.proposta_id = p.id AND l.locked_until > now()
) lock ON true
WHERE p.deleted_at IS NULL
  AND p.status <> ALL (ARRAY['aceita','recusada','expirada','rascunho']);