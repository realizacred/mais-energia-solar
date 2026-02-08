
-- Restringir INSERT público em simulacoes
DROP POLICY IF EXISTS "Anon can insert simulacoes" ON public.simulacoes;

CREATE POLICY "Public insert simulacoes with restrictions"
  ON public.simulacoes
  FOR INSERT
  WITH CHECK (
    -- Campos mínimos de cálculo devem estar presentes
    consumo_kwh IS NOT NULL AND consumo_kwh > 0
    -- lead_id pode ser null (simulação anônima)
    -- Todos os campos de resultado são opcionais
  );
