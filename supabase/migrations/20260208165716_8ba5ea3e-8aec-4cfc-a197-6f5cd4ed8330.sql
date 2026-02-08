
-- ============================================================
-- REFORÇO RLS: Restringir INSERT público em leads e orcamentos
-- Impedir que atacantes manipulem colunas sensíveis
-- ============================================================

-- 1. Substituir policy "Anyone can insert leads" por versão restritiva
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;

CREATE POLICY "Public insert leads with restrictions"
  ON public.leads
  FOR INSERT
  WITH CHECK (
    -- Campos obrigatórios devem estar presentes
    nome IS NOT NULL AND length(trim(nome)) >= 2
    AND telefone IS NOT NULL AND length(trim(telefone)) >= 10
    AND cidade IS NOT NULL
    AND estado IS NOT NULL
    AND area IS NOT NULL
    AND tipo_telhado IS NOT NULL
    AND rede_atendimento IS NOT NULL
    AND media_consumo IS NOT NULL AND media_consumo > 0
    AND consumo_previsto IS NOT NULL AND consumo_previsto > 0
    -- Campos sensíveis devem manter valores padrão
    AND visto = false
    AND visto_admin = false
    -- Não permitir definir status_id (deve ser null para leads novos)
    AND status_id IS NULL
    -- Não permitir definir observacoes administrativas
    AND observacoes IS NULL
    -- Não permitir forjar lead_code (gerado por trigger)
    AND lead_code IS NULL
  );

-- 2. Substituir policy "Anyone can insert orcamentos" por versão restritiva
DROP POLICY IF EXISTS "Anyone can insert orcamentos" ON public.orcamentos;

CREATE POLICY "Public insert orcamentos with restrictions"
  ON public.orcamentos
  FOR INSERT
  WITH CHECK (
    -- Campos obrigatórios
    lead_id IS NOT NULL
    AND tipo_telhado IS NOT NULL
    AND area IS NOT NULL
    AND estado IS NOT NULL
    AND cidade IS NOT NULL
    AND rede_atendimento IS NOT NULL
    AND media_consumo IS NOT NULL AND media_consumo > 0
    AND consumo_previsto IS NOT NULL AND consumo_previsto > 0
    -- Campos sensíveis devem manter valores padrão
    AND visto = false
    AND visto_admin = false
    AND status_id IS NULL
    AND observacoes IS NULL
    AND orc_code IS NULL
  );

-- 3. Verificar policy INSERT de simulacoes (se existir)
-- Simulacoes são anônimas e já têm rate limit trigger
-- Nenhuma ação adicional necessária
