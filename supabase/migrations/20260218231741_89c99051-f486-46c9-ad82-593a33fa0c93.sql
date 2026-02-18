
-- Create otimizadores_catalogo table (same pattern as inversores_catalogo/modulos_solares)
CREATE TABLE public.otimizadores_catalogo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  fabricante TEXT NOT NULL,
  modelo TEXT NOT NULL,
  potencia_wp NUMERIC NULL,
  tensao_entrada_max_v NUMERIC NULL,
  corrente_entrada_max_a NUMERIC NULL,
  tensao_saida_v NUMERIC NULL,
  corrente_saida_max_a NUMERIC NULL,
  eficiencia_percent NUMERIC NULL,
  compatibilidade TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, fabricante, modelo)
);

-- Enable RLS
ALTER TABLE public.otimizadores_catalogo ENABLE ROW LEVEL SECURITY;

-- Global catalog (tenant_id IS NULL) readable by all authenticated users
CREATE POLICY "Global otimizadores readable by authenticated"
  ON public.otimizadores_catalogo FOR SELECT
  USING (tenant_id IS NULL AND auth.role() = 'authenticated');

-- Tenant-specific readable by tenant members
CREATE POLICY "Tenant otimizadores readable by tenant members"
  ON public.otimizadores_catalogo FOR SELECT
  USING (tenant_id IS NOT NULL AND tenant_id = get_user_tenant_id());

-- Tenant members can insert their own
CREATE POLICY "Tenant members can insert otimizadores"
  ON public.otimizadores_catalogo FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Tenant members can update their own
CREATE POLICY "Tenant members can update otimizadores"
  ON public.otimizadores_catalogo FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

-- Tenant members can delete their own
CREATE POLICY "Tenant members can delete otimizadores"
  ON public.otimizadores_catalogo FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Trigger for updated_at
CREATE TRIGGER update_otimizadores_catalogo_updated_at
  BEFORE UPDATE ON public.otimizadores_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
