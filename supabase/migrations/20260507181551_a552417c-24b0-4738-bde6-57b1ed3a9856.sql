DROP TRIGGER IF EXISTS trg_normalize_cliente_telefone ON public.clientes;
DROP FUNCTION IF EXISTS public.normalize_cliente_telefone();

CREATE TABLE IF NOT EXISTS public.sm_manual_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'solarmarket',
  source_entity_type text NOT NULL,
  source_entity_id text NOT NULL,
  reason text NOT NULL,
  attempts int NOT NULL DEFAULT 1,
  conflict_entity_type text,
  conflict_entity_id uuid,
  conflict_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sm_manual_review UNIQUE (tenant_id, source, source_entity_type, source_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_sm_manual_review_open
  ON public.sm_manual_review (tenant_id, source_entity_type, resolved_at)
  WHERE resolved_at IS NULL;

ALTER TABLE public.sm_manual_review ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_sm_manual_review_select" ON public.sm_manual_review;
CREATE POLICY "tenant_isolation_sm_manual_review_select"
  ON public.sm_manual_review FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_sm_manual_review_modify" ON public.sm_manual_review;
CREATE POLICY "tenant_isolation_sm_manual_review_modify"
  ON public.sm_manual_review FOR ALL
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_sm_manual_review_updated ON public.sm_manual_review;
CREATE TRIGGER trg_sm_manual_review_updated
  BEFORE UPDATE ON public.sm_manual_review
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.external_entity_links
  (tenant_id, entity_type, entity_id, source, source_entity_type, source_entity_id, metadata)
VALUES
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'cliente',
   '0128cf0d-ab7f-4128-bddc-8b93c7d67706', 'solarmarket', 'cliente', '86',
   jsonb_build_object('matched_by','manual_reconcile_phone_same_person','reason','typo_first_name','reconciled_at',now())),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'cliente',
   'ac260226-6ed7-4cbf-8c31-ec81d83be928', 'solarmarket', 'cliente', '920',
   jsonb_build_object('matched_by','manual_reconcile_phone_same_person','reason','same_first_name','reconciled_at',now()))
ON CONFLICT (tenant_id, source, source_entity_type, source_entity_id) DO NOTHING;

INSERT INTO public.sm_manual_review
  (tenant_id, source, source_entity_type, source_entity_id, reason,
   conflict_entity_type, conflict_entity_id, conflict_metadata, attempts)
VALUES
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'solarmarket', 'cliente', '71',
   'phone_collision_diff_name', 'cliente',
   '8e41fe4a-c0c9-457b-b17e-64de64eabed9',
   jsonb_build_object('sm_name','Gilberto Delfim de Carvalho','sm_phone_canonical','32999466877',
     'crm_existing_name','Denise Mara','related_propostas',jsonb_build_array('74')), 576),
  ('17de8315-2e2f-4a79-8751-e5d507d69a41', 'solarmarket', 'cliente', '880',
   'phone_collision_diff_name', 'cliente',
   'd9e5711c-a245-41d6-9382-4483e7dee446',
   jsonb_build_object('sm_name','RICARDO','sm_phone_canonical','32998158283',
     'crm_existing_name','Fábio Ribeiro','related_propostas',jsonb_build_array('884')), 539)
ON CONFLICT (tenant_id, source, source_entity_type, source_entity_id)
DO UPDATE SET attempts = EXCLUDED.attempts, updated_at = now();
