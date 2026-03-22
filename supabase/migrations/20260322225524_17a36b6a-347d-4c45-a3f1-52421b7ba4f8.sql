-- ============================================================================
-- Expansão da Central de Extração: Motor Adaptativo Enterprise
-- Adiciona campos para obrigatoriedade por contexto, sinais de tipo UC,
-- suporte a documentos futuros, recuperação e regras de layout por config.
-- ============================================================================

-- 1. Campos obrigatórios por contexto (mista e consumo puro)
ALTER TABLE public.invoice_extraction_configs
  ADD COLUMN IF NOT EXISTS required_fields_mista jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS required_fields_consumo jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Campos desejáveis e bloqueantes
ALTER TABLE public.invoice_extraction_configs
  ADD COLUMN IF NOT EXISTS desired_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blocking_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Sinais de detecção de tipo de UC (por concessionária)
ALTER TABLE public.invoice_extraction_configs
  ADD COLUMN IF NOT EXISTS geradora_signals jsonb NOT NULL DEFAULT '["energia_injetada_kwh", "leitura_103", "medidor_injecao"]'::jsonb,
  ADD COLUMN IF NOT EXISTS beneficiaria_signals jsonb NOT NULL DEFAULT '["energia_compensada_kwh", "saldo_gd_acumulado", "creditos_recebidos"]'::jsonb,
  ADD COLUMN IF NOT EXISTS mista_signals jsonb NOT NULL DEFAULT '["energia_injetada_kwh", "energia_compensada_kwh"]'::jsonb;

-- 4. Suporte a tipo de documento
ALTER TABLE public.invoice_extraction_configs
  ADD COLUMN IF NOT EXISTS source_type_supported text NOT NULL DEFAULT 'pdf';

-- 5. Recuperação automática (fallback interno)
ALTER TABLE public.invoice_extraction_configs
  ADD COLUMN IF NOT EXISTS recovery_enabled boolean NOT NULL DEFAULT false;

-- 6. Regras de layout embutidas na config (referência rápida)
ALTER TABLE public.invoice_extraction_configs
  ADD COLUMN IF NOT EXISTS layout_rules jsonb NOT NULL DEFAULT '[]'::jsonb;