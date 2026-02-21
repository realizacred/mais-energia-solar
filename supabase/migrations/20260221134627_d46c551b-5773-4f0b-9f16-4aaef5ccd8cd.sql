
-- Fase 1: Dicionário de Match ANEEL
-- Adicionar nome ANEEL oficial à tabela concessionárias
ALTER TABLE public.concessionarias
  ADD COLUMN IF NOT EXISTS nome_aneel_oficial text;

COMMENT ON COLUMN public.concessionarias.nome_aneel_oficial IS 'Nome exato como aparece no XLS da ANEEL para matching automático';

-- Tabela de aliases ANEEL (múltiplos nomes por concessionária)
CREATE TABLE IF NOT EXISTS public.concessionaria_aneel_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  concessionaria_id uuid NOT NULL REFERENCES public.concessionarias(id) ON DELETE CASCADE,
  alias_aneel text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT uq_alias_tenant UNIQUE (tenant_id, alias_aneel)
);

-- Index for fast lookups during import
CREATE INDEX idx_aneel_aliases_lookup ON public.concessionaria_aneel_aliases(tenant_id, alias_aneel);
CREATE INDEX idx_aneel_aliases_conc ON public.concessionaria_aneel_aliases(concessionaria_id);

-- RLS
ALTER TABLE public.concessionaria_aneel_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for aneel aliases"
  ON public.concessionaria_aneel_aliases
  FOR ALL
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );
