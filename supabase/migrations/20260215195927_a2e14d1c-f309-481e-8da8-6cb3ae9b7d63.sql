-- Adicionar campos de instalação e engenharia complementares ao projeto
-- Esses campos alimentam diretamente o motor de documentos (variáveis de contrato)

ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS area_util_m2 numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS geracao_mensal_media_kwh numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_entrada numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_financiado numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS numero_parcelas integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_parcela numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prazo_estimado_dias integer DEFAULT 90,
  ADD COLUMN IF NOT EXISTS prazo_vistoria_dias integer DEFAULT 7,
  ADD COLUMN IF NOT EXISTS numero_inversores integer DEFAULT NULL;

-- Índice para busca rápida por forma de pagamento
CREATE INDEX IF NOT EXISTS idx_projetos_forma_pagamento ON public.projetos (forma_pagamento) WHERE forma_pagamento IS NOT NULL;

COMMENT ON COLUMN public.projetos.area_util_m2 IS 'Área útil do sistema em m²';
COMMENT ON COLUMN public.projetos.geracao_mensal_media_kwh IS 'Geração mensal média estimada em kWh';
COMMENT ON COLUMN public.projetos.forma_pagamento IS 'Tipo: a_vista, financiamento, parcelado';
COMMENT ON COLUMN public.projetos.prazo_estimado_dias IS 'Prazo estimado de instalação em dias';
COMMENT ON COLUMN public.projetos.prazo_vistoria_dias IS 'Prazo da vistoria após instalação em dias';