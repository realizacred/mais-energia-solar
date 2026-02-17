
-- Tabela de modelos de e-mail (por tenant) — sem subquery no default
CREATE TABLE IF NOT EXISTS public.proposta_email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  nome text NOT NULL,
  assunto text NOT NULL,
  corpo_html text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposta_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant email templates"
  ON public.proposta_email_templates FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage own tenant email templates"
  ON public.proposta_email_templates FOR ALL
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger para auto-set tenant_id
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.profiles WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_set_tenant_email_templates
  BEFORE INSERT ON public.proposta_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_profile();
