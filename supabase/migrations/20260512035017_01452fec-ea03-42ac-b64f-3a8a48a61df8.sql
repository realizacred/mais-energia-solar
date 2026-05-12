
-- Document signers — per-document signer tracking for the signature panel
CREATE TABLE IF NOT EXISTS public.document_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  provider_signer_id text,
  name text NOT NULL,
  email text,
  cpf text,
  phone text,
  role text,
  order_index int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  sign_url text,
  viewed_at timestamptz,
  signed_at timestamptz,
  refused_at timestamptz,
  last_resent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_signers_document ON public.document_signers(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_tenant ON public.document_signers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_provider_id ON public.document_signers(provider_signer_id);

ALTER TABLE public.document_signers ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read: any user of the tenant
CREATE POLICY "tenant members can view document_signers"
  ON public.document_signers FOR SELECT
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

-- Updates by tenant members (e.g. updating last_resent_at locally is via edge fn,
-- but allow tenant updates safely scoped)
CREATE POLICY "tenant members can update document_signers"
  ON public.document_signers FOR UPDATE
  USING (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = ((auth.jwt() ->> 'tenant_id')::uuid));

-- INSERT/DELETE only via service role (Edge Functions). No policy → blocked for clients.

-- Trigger: keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_document_signers_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_document_signers ON public.document_signers;
CREATE TRIGGER trg_touch_document_signers
  BEFORE UPDATE ON public.document_signers
  FOR EACH ROW EXECUTE FUNCTION public.touch_document_signers_updated_at();

-- Realtime: enable replica identity full so payloads include all columns
ALTER TABLE public.document_signers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_signers;
