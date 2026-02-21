
-- ─── Tabela de Tarifas por Subgrupo por Concessionária ──────────────
-- Armazena tarifas específicas por subgrupo + modalidade tarifária
-- Substitui o uso de tenant_premises para tarifas no wizard de propostas

CREATE TABLE public.concessionaria_tarifas_subgrupo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  concessionaria_id UUID NOT NULL REFERENCES public.concessionarias(id) ON DELETE CASCADE,
  
  -- Identificação do subgrupo
  subgrupo TEXT NOT NULL, -- 'B1', 'B2', 'B3', 'A1', 'A2', 'A3', 'A3a', 'A4', 'AS'
  modalidade_tarifaria TEXT, -- NULL para BT, 'Verde' ou 'Azul' para MT
  
  -- Tarifas BT (Grupo B)
  tarifa_energia NUMERIC DEFAULT 0,
  tarifa_fio_b NUMERIC DEFAULT 0,
  
  -- Tarifas MT Ponta (Grupo A)
  te_ponta NUMERIC DEFAULT 0,
  tusd_ponta NUMERIC DEFAULT 0,
  fio_b_ponta NUMERIC DEFAULT 0,
  
  -- Tarifas MT Fora Ponta (Grupo A)
  te_fora_ponta NUMERIC DEFAULT 0,
  tusd_fora_ponta NUMERIC DEFAULT 0,
  fio_b_fora_ponta NUMERIC DEFAULT 0,
  
  -- GD3 Tarifação compensada
  tarifacao_ponta NUMERIC DEFAULT 0,
  tarifacao_fora_ponta NUMERIC DEFAULT 0,
  tarifacao_bt NUMERIC DEFAULT 0,
  
  -- Demanda (R$/kW)
  demanda_consumo_rs NUMERIC DEFAULT 0,
  demanda_geracao_rs NUMERIC DEFAULT 0,
  
  -- Metadata
  vigencia_inicio DATE,
  is_active BOOLEAN DEFAULT true,
  origem TEXT DEFAULT 'manual', -- 'manual', 'aneel_sync'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: unique per tenant+conc+subgrupo+modalidade
  CONSTRAINT uq_conc_tarifa_subgrupo UNIQUE (tenant_id, concessionaria_id, subgrupo, modalidade_tarifaria)
);

-- Índices
CREATE INDEX idx_conc_tarifas_sub_tenant ON public.concessionaria_tarifas_subgrupo(tenant_id);
CREATE INDEX idx_conc_tarifas_sub_conc ON public.concessionaria_tarifas_subgrupo(concessionaria_id);
CREATE INDEX idx_conc_tarifas_sub_lookup ON public.concessionaria_tarifas_subgrupo(tenant_id, concessionaria_id, subgrupo, is_active);

-- RLS
ALTER TABLE public.concessionaria_tarifas_subgrupo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select"
  ON public.concessionaria_tarifas_subgrupo FOR SELECT
  USING (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenant isolation - insert"
  ON public.concessionaria_tarifas_subgrupo FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenant isolation - update"
  ON public.concessionaria_tarifas_subgrupo FOR UPDATE
  USING (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

CREATE POLICY "Tenant isolation - delete"
  ON public.concessionaria_tarifas_subgrupo FOR DELETE
  USING (tenant_id IN (
    SELECT p.tenant_id FROM public.profiles p WHERE p.user_id = auth.uid()
  ));

-- Trigger updated_at
CREATE TRIGGER update_conc_tarifas_sub_updated_at
  BEFORE UPDATE ON public.concessionaria_tarifas_subgrupo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
