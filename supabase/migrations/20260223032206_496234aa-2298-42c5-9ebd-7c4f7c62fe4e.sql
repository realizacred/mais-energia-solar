
-- Tabela de fornecedores (distribuidores/fabricantes de equipamentos)
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  nome TEXT NOT NULL,
  cnpj TEXT,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  site TEXT,
  contato_nome TEXT,
  contato_telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  tipo TEXT NOT NULL DEFAULT 'distribuidor', -- distribuidor, fabricante, integrador
  categorias TEXT[] DEFAULT '{}', -- inversores, modulos, estruturas, cabos, etc
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation - select"
ON public.fornecedores FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - insert"
ON public.fornecedores FOR INSERT
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - update"
ON public.fornecedores FOR UPDATE
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation - delete"
ON public.fornecedores FOR DELETE
USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Índices
CREATE INDEX idx_fornecedores_tenant ON public.fornecedores(tenant_id);
CREATE INDEX idx_fornecedores_ativo ON public.fornecedores(tenant_id, ativo);

-- Trigger updated_at
CREATE TRIGGER update_fornecedores_updated_at
BEFORE UPDATE ON public.fornecedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
