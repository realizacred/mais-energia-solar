
-- =====================================================================
-- ONDA A — Saúde básica (idempotente, reversível)
-- =====================================================================

-- 1) ANALYZE manual nas tabelas com estatísticas defasadas
ANALYZE public.proposta_versoes;
ANALYZE public.proposal_events;
ANALYZE public.projetos;
ANALYZE public.project_operational_projection;
ANALYZE public.projeto_pendencias;
ANALYZE public.deals;

-- 2) Drop dos índices mortos em proposta_versoes
--    Critério: idx_scan = 0 desde criação, NÃO é UNIQUE, NÃO é PK,
--    NÃO é índice de token público, NÃO suporta idempotência,
--    NÃO é o índice de tenant_id (único usado) e NÃO é duplicata necessária.
--
--    PRESERVADOS (justificativa):
--      • proposta_versoes_pkey                  PK (978 scans)
--      • uq_proposta_versoes_idempotency        UNIQUE (idempotency_key)
--      • uq_proposta_versao                     UNIQUE (proposta_id, versao_numero)
--      • idx_proposta_versoes_public_slug       UNIQUE token público
--      • idx_proposta_versoes_tenant            tenant filter (4 scans + RLS)
--      • idx_proposta_versoes_proposta_numero   376 scans (hot path)
DROP INDEX IF EXISTS public.idx_proposta_versoes_proposta;          -- duplicata do _proposta_numero
DROP INDEX IF EXISTS public.idx_proposta_versoes_status;            -- 0 scans
DROP INDEX IF EXISTS public.idx_proposta_versoes_generation_status; -- 0 scans (será recriado se necessário)
DROP INDEX IF EXISTS public.idx_proposta_versoes_tipo_projeto_solar;
DROP INDEX IF EXISTS public.idx_pv_link_pdf;
DROP INDEX IF EXISTS public.idx_pv_tenant_consumo;
DROP INDEX IF EXISTS public.idx_pv_tenant_distribuidora;
DROP INDEX IF EXISTS public.idx_pv_tenant_economia_percent;
DROP INDEX IF EXISTS public.idx_pv_tenant_geracao_anual;
DROP INDEX IF EXISTS public.idx_pv_tenant_origem;
DROP INDEX IF EXISTS public.idx_pv_tenant_tarifa;
DROP INDEX IF EXISTS public.idx_pv_tenant_tir;
DROP INDEX IF EXISTS public.idx_pv_tenant_vpl;

-- 3) Ajuste fino de autovacuum SOMENTE em tabelas de domínio voláteis
--    Default: scale_factor 0.10 + threshold 50 → para 1.900 rows precisa de
--    240 modificações antes de auto-analyze. Reduzimos para 5% → 145.
--    Não toca config global; só estas duas tabelas.
ALTER TABLE public.proposta_versoes
  SET (autovacuum_analyze_scale_factor = 0.05,
       autovacuum_vacuum_scale_factor  = 0.10);

ALTER TABLE public.deals
  SET (autovacuum_analyze_scale_factor = 0.05,
       autovacuum_vacuum_scale_factor  = 0.10);
