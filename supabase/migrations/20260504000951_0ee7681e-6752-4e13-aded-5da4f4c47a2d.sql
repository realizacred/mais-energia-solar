
-- ============================================================================
-- AUDITORIA DE EQUIPAMENTOS: Baterias, Módulos, Otimizadores
-- Mesma estrutura aplicada em Inversores (RB-59 paridade).
-- ============================================================================

-- 1) Adicionar colunas de auditoria + datasheet/garantia em baterias
ALTER TABLE public.baterias
  ADD COLUMN IF NOT EXISTS garantia_anos integer,
  ADD COLUMN IF NOT EXISTS datasheet_url text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS audit_status text,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_notes text,
  ADD COLUMN IF NOT EXISTS audit_original jsonb;

-- 2) Adicionar colunas de auditoria em módulos
ALTER TABLE public.modulos_solares
  ADD COLUMN IF NOT EXISTS audit_status text,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_notes text,
  ADD COLUMN IF NOT EXISTS audit_original jsonb;

-- 3) Adicionar colunas de auditoria em otimizadores
ALTER TABLE public.otimizadores_catalogo
  ADD COLUMN IF NOT EXISTS audit_status text,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS audit_notes text,
  ADD COLUMN IF NOT EXISTS audit_original jsonb;

-- 4) Tabela de log compartilhada (já existe inversores_audit_log; criamos genérica)
CREATE TABLE IF NOT EXISTS public.equipamentos_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_type text NOT NULL,
  equipment_id uuid NOT NULL,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  reason text,
  performed_by uuid,
  performed_at timestamptz DEFAULT now()
);
ALTER TABLE public.equipamentos_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.equipamentos_audit_log;
CREATE POLICY "audit_log_select_admin" ON public.equipamentos_audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "audit_log_insert_admin" ON public.equipamentos_audit_log;
CREATE POLICY "audit_log_insert_admin" ON public.equipamentos_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- FASE 1 — NORMALIZAÇÃO DE FABRICANTES (UPPERCASE + trim) e GARANTIAS PADRÃO
-- ============================================================================

-- Backup do estado original (apenas para registros que mudarão)
UPDATE public.baterias
SET audit_original = jsonb_build_object('fabricante', fabricante, 'garantia_anos', garantia_anos)
WHERE audit_original IS NULL
  AND (fabricante <> upper(trim(fabricante)) OR garantia_anos IS NULL);

UPDATE public.modulos_solares
SET audit_original = jsonb_build_object('fabricante', fabricante, 'garantia_produto_anos', garantia_produto_anos)
WHERE audit_original IS NULL
  AND (fabricante <> upper(trim(fabricante)) OR garantia_produto_anos IS NULL);

UPDATE public.otimizadores_catalogo
SET audit_original = jsonb_build_object('fabricante', fabricante, 'garantia_anos', garantia_anos)
WHERE audit_original IS NULL
  AND (fabricante <> upper(trim(fabricante)) OR garantia_anos IS NULL);

-- Normalizar fabricantes (UPPERCASE + trim)
UPDATE public.baterias
  SET fabricante = upper(trim(fabricante)), audit_status = 'normalizado', audited_at = now()
WHERE fabricante IS NOT NULL AND fabricante <> upper(trim(fabricante));

UPDATE public.modulos_solares
  SET fabricante = upper(trim(fabricante)), audit_status = 'normalizado', audited_at = now()
WHERE fabricante IS NOT NULL AND fabricante <> upper(trim(fabricante));

UPDATE public.otimizadores_catalogo
  SET fabricante = upper(trim(fabricante)), audit_status = 'normalizado', audited_at = now()
WHERE fabricante IS NOT NULL AND fabricante <> upper(trim(fabricante));

-- ============================================================================
-- GARANTIAS PADRÃO POR FABRICANTE
-- ============================================================================

-- BATERIAS: padrão de mercado
UPDATE public.baterias SET garantia_anos = 10, audit_status = COALESCE(audit_status,'normalizado'), audited_at = now()
WHERE garantia_anos IS NULL AND upper(fabricante) IN ('BYD','PYLONTECH','GROWATT','DEYE','HUAWEI','SUNGROW','GOODWE','SOLIS','LG','LG ENERGY SOLUTION','TESLA','WEG');

UPDATE public.baterias SET garantia_anos = 5, audit_status = COALESCE(audit_status,'normalizado'), audited_at = now()
WHERE garantia_anos IS NULL AND upper(fabricante) IN ('FREEDOM','UNIPOWER','MOURA','HELIAR');

-- MÓDULOS FOTOVOLTAICOS: garantia de produto (não performance)
UPDATE public.modulos_solares SET garantia_produto_anos = 12, audit_status = COALESCE(audit_status,'normalizado'), audited_at = now()
WHERE garantia_produto_anos IS NULL AND upper(fabricante) IN ('JINKO','JINKO SOLAR','TRINA','TRINA SOLAR','JA SOLAR','LONGI','CANADIAN','CANADIAN SOLAR','RISEN','ZNSHINE','ASTRONERGY','BYD','SUNTECH','EGING','SERAPHIM');

UPDATE public.modulos_solares SET garantia_produto_anos = 15, audit_status = COALESCE(audit_status,'normalizado'), audited_at = now()
WHERE garantia_produto_anos IS NULL AND upper(fabricante) IN ('LONGI','HUASUN','AIKO','REC','LG','PANASONIC','SUNPOWER');

-- OTIMIZADORES
UPDATE public.otimizadores_catalogo SET garantia_anos = 25, audit_status = COALESCE(audit_status,'normalizado'), audited_at = now()
WHERE garantia_anos IS NULL AND upper(fabricante) IN ('SOLAREDGE','TIGO');

UPDATE public.otimizadores_catalogo SET garantia_anos = 12, audit_status = COALESCE(audit_status,'normalizado'), audited_at = now()
WHERE garantia_anos IS NULL AND upper(fabricante) IN ('HUAWEI','SUNGROW');

-- ============================================================================
-- MARCAR PENDENTES
-- ============================================================================
UPDATE public.baterias SET audit_status = 'pendente_datasheet'
WHERE datasheet_url IS NULL AND audit_status IS NULL;

UPDATE public.modulos_solares SET audit_status = 'pendente_datasheet'
WHERE datasheet_url IS NULL AND audit_status IS NULL;

UPDATE public.otimizadores_catalogo SET audit_status = 'pendente_datasheet'
WHERE datasheet_url IS NULL AND audit_status IS NULL;

-- Specs incompletas: sem garantia ou sem datasheet
UPDATE public.baterias SET audit_status = 'specs_incompletas'
WHERE audit_status IS NULL AND (garantia_anos IS NULL OR energia_kwh IS NULL);

UPDATE public.modulos_solares SET audit_status = 'specs_incompletas'
WHERE audit_status IS NULL AND (garantia_produto_anos IS NULL OR eficiencia_percent IS NULL);

UPDATE public.otimizadores_catalogo SET audit_status = 'specs_incompletas'
WHERE audit_status IS NULL AND (garantia_anos IS NULL OR potencia_wp IS NULL);
