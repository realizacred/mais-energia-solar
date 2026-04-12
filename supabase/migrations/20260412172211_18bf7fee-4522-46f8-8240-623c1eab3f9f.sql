-- Limpar todos os logs de erro históricos da migração SM
-- Auditoria confirmou que são 212 registros antigos causados por bug de enum já corrigido
-- Todos os sm_proposal_id com erro já possuem log SUCCESS posterior
DELETE FROM public.sm_migration_log WHERE status = 'ERROR';

-- Também limpar logs SUCCESS antigos para permitir re-migração limpa
-- (o usuário quer começar do zero)
DELETE FROM public.sm_migration_log WHERE status IN ('SUCCESS', 'SKIP');

-- Resetar flag migrado_em nas propostas SM para permitir re-processamento
UPDATE public.solar_market_proposals SET migrado_em = NULL WHERE migrado_em IS NOT NULL;