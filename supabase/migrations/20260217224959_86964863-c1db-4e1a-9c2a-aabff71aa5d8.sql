
-- Criar tabela proposta_config (configurações de validade de propostas)
CREATE TABLE public.proposta_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  proposta_tem_validade BOOLEAN NOT NULL DEFAULT true,
  proposta_validade_dias INTEGER NOT NULL DEFAULT 10,
  proposta_exibir_expirada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Uma config por tenant
CREATE UNIQUE INDEX idx_proposta_config_tenant ON public.proposta_config(tenant_id);

-- RLS
ALTER TABLE public.proposta_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view proposta_config"
  ON public.proposta_config FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant members can insert proposta_config"
  ON public.proposta_config FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant members can update proposta_config"
  ON public.proposta_config FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_proposta_config_updated_at
  BEFORE UPDATE ON public.proposta_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
