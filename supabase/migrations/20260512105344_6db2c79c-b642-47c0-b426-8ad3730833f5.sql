DROP POLICY IF EXISTS "tenant members can view document_signers" ON public.document_signers;
DROP POLICY IF EXISTS "tenant members can update document_signers" ON public.document_signers;

CREATE POLICY "tenant members can view document_signers"
  ON public.document_signers FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant members can update document_signers"
  ON public.document_signers FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());