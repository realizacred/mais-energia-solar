
-- 1. Create lead_origens table
CREATE TABLE public.lead_origens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT get_user_tenant_id(auth.uid()),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_origens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_lead_origens"
  ON public.lead_origens FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_lead_origens"
  ON public.lead_origens FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_lead_origens"
  ON public.lead_origens FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_delete_lead_origens"
  ON public.lead_origens FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX idx_lead_origens_tenant ON public.lead_origens(tenant_id);

-- 2. Add lead_origem_id to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_origem_id uuid REFERENCES public.lead_origens(id) ON DELETE SET NULL;

-- 3. Seed default origins for all existing tenants
DO $$
DECLARE
  t_id uuid;
  origens text[] := ARRAY['Indicação','Site','Instagram','Facebook / Meta','Google','Cold Call','WhatsApp','Feira / Evento','Outro'];
  o text;
  idx int;
BEGIN
  FOR t_id IN SELECT id FROM public.tenants LOOP
    idx := 0;
    FOREACH o IN ARRAY origens LOOP
      INSERT INTO public.lead_origens (tenant_id, nome, ativo, ordem)
      VALUES (t_id, o, true, idx)
      ON CONFLICT DO NOTHING;
      idx := idx + 1;
    END LOOP;
  END LOOP;
END $$;
