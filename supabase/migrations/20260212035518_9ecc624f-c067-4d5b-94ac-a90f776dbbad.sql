
-- Tabela para armazenar API keys de integrações por tenant
-- Source of truth para chaves configuráveis via admin panel
CREATE TABLE public.integration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  service_key TEXT NOT NULL,  -- 'openai', 'solarmarket', 'evolution', etc.
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, service_key)
);

-- RLS: somente admins do tenant
ALTER TABLE public.integration_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read integration configs"
ON public.integration_configs FOR SELECT
USING (
  is_admin(auth.uid()) 
  AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "Admins can insert integration configs"
ON public.integration_configs FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) 
  AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "Admins can update integration configs"
ON public.integration_configs FOR UPDATE
USING (
  is_admin(auth.uid()) 
  AND tenant_id = get_user_tenant_id()
)
WITH CHECK (
  is_admin(auth.uid()) 
  AND tenant_id = get_user_tenant_id()
);

CREATE POLICY "Admins can delete integration configs"
ON public.integration_configs FOR DELETE
USING (
  is_admin(auth.uid()) 
  AND tenant_id = get_user_tenant_id()
);

-- Trigger para updated_at
CREATE TRIGGER update_integration_configs_updated_at
BEFORE UPDATE ON public.integration_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função segura para edge functions lerem a chave (service_role only via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_integration_key(_service_key text, _tenant_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _key text;
  _tid uuid;
BEGIN
  -- Resolve tenant: explicit param > user context
  _tid := COALESCE(_tenant_id, get_user_tenant_id());
  
  IF _tid IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT api_key INTO _key
  FROM integration_configs
  WHERE service_key = _service_key
    AND tenant_id = _tid
    AND is_active = true
  LIMIT 1;
  
  RETURN _key;
END;
$$;
