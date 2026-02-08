
-- Fix: Permitir media_consumo = 0 em leads (placeholder do wizard)
-- Os valores reais ficam no orcamento vinculado
DROP POLICY IF EXISTS "Public insert leads with restrictions" ON public.leads;

CREATE POLICY "Public insert leads with restrictions"
  ON public.leads
  FOR INSERT
  WITH CHECK (
    -- Campos obrigatórios
    nome IS NOT NULL AND length(trim(nome)) >= 2
    AND telefone IS NOT NULL AND length(trim(telefone)) >= 10
    AND cidade IS NOT NULL
    AND estado IS NOT NULL
    AND area IS NOT NULL
    AND tipo_telhado IS NOT NULL
    AND rede_atendimento IS NOT NULL
    AND media_consumo IS NOT NULL AND media_consumo >= 0
    AND consumo_previsto IS NOT NULL AND consumo_previsto >= 0
    -- Campos sensíveis devem manter valores padrão
    AND visto = false
    AND visto_admin = false
    AND status_id IS NULL
    AND observacoes IS NULL
    AND lead_code IS NULL
  );
