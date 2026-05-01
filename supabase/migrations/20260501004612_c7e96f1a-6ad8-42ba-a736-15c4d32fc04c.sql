-- Backfill: o RPC registrar_view_proposta falhava silenciosamente porque o front
-- omitia o argumento p_ip (assinatura tem 6 args nomeados). last_viewed_at e
-- duracao_total_segundos foram populados pelo heartbeat, mas view_count,
-- first_viewed_at, total_aberturas, primeiro_acesso_em, status_visualizacao
-- ficaram zerados. Sincronizamos contadores a partir do heartbeat.

-- 1. Tokens: se houve heartbeat (last_viewed_at preenchido) mas view_count=0,
--    consideramos pelo menos 1 abertura.
UPDATE proposta_aceite_tokens
SET
  view_count = GREATEST(view_count, 1),
  first_viewed_at = COALESCE(first_viewed_at, last_viewed_at)
WHERE last_viewed_at IS NOT NULL
  AND (view_count = 0 OR view_count IS NULL OR first_viewed_at IS NULL)
  AND tipo IS DISTINCT FROM 'public';

-- 2. Propostas: agregar do token mais recente.
UPDATE propostas_nativas pn
SET
  primeiro_acesso_em = COALESCE(pn.primeiro_acesso_em, t.first_viewed_at),
  ultimo_acesso_em = GREATEST(COALESCE(pn.ultimo_acesso_em, t.last_viewed_at), t.last_viewed_at),
  total_aberturas = GREATEST(COALESCE(pn.total_aberturas, 0), t.total_views),
  status_visualizacao = CASE
    WHEN pn.status_visualizacao IN ('aceita','recusada','expirada') THEN pn.status_visualizacao
    ELSE 'aberto'
  END
FROM (
  SELECT proposta_id,
         MIN(first_viewed_at) AS first_viewed_at,
         MAX(last_viewed_at) AS last_viewed_at,
         COALESCE(SUM(view_count), 0) AS total_views
  FROM proposta_aceite_tokens
  WHERE tipo IS DISTINCT FROM 'public'
    AND last_viewed_at IS NOT NULL
  GROUP BY proposta_id
) t
WHERE pn.id = t.proposta_id
  AND (pn.total_aberturas = 0 OR pn.total_aberturas IS NULL OR pn.primeiro_acesso_em IS NULL);