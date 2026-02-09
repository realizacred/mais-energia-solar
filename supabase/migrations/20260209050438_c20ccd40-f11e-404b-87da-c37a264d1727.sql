-- ═══════════════════════════════════════════════════════════════
-- STORAGE ISOLATION: Tenant-scoped storage policies
-- Path pattern: {tenant_id}/...rest
-- Policy check: (storage.foldername(name))[1] = tenant_id
-- ═══════════════════════════════════════════════════════════════

-- ── DROP ALL EXISTING STORAGE POLICIES ──────────────────────────

-- brand-assets
DROP POLICY IF EXISTS "Admins can upload brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete brand assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read brand assets" ON storage.objects;

-- obras-portfolio
DROP POLICY IF EXISTS "Admins upload obras-portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Admins update obras-portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete obras-portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Public read obras-portfolio" ON storage.objects;

-- wa-attachments
DROP POLICY IF EXISTS "Authenticated users can upload wa-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete wa-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view wa-attachments" ON storage.objects;

-- contas-luz
DROP POLICY IF EXISTS "Admins manage contas-luz" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload contas-luz" ON storage.objects;
DROP POLICY IF EXISTS "Vendedores read contas-luz" ON storage.objects;
DROP POLICY IF EXISTS "Vendedores upload contas-luz" ON storage.objects;

-- lead-arquivos
DROP POLICY IF EXISTS "Admins manage lead-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload lead-arquivos" ON storage.objects;
DROP POLICY IF EXISTS "Vendedores read lead-arquivos" ON storage.objects;

-- documentos-clientes
DROP POLICY IF EXISTS "Admins manage documentos-clientes" ON storage.objects;
DROP POLICY IF EXISTS "Vendedores read documentos-clientes" ON storage.objects;
DROP POLICY IF EXISTS "Vendedores upload documentos-clientes" ON storage.objects;

-- checklist-assets
DROP POLICY IF EXISTS "Admins manage checklist-assets" ON storage.objects;
DROP POLICY IF EXISTS "Instaladores read own checklist-assets" ON storage.objects;
DROP POLICY IF EXISTS "Instaladores upload checklist-assets" ON storage.objects;

-- comprovantes
DROP POLICY IF EXISTS "Admins manage comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Financeiro read comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Financeiro upload comprovantes" ON storage.objects;

-- ═══════════════════════════════════════════════════════════════
-- NEW TENANT-SCOPED POLICIES
-- All use: (storage.foldername(name))[1] = get_user_tenant_id()::text
-- ═══════════════════════════════════════════════════════════════

-- ── BRAND-ASSETS (public bucket) ─────────────────────────────

CREATE POLICY "storage_brand_assets_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'brand-assets');

CREATE POLICY "storage_brand_assets_insert_admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'brand-assets'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_brand_assets_update_admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_brand_assets_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'brand-assets'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- ── OBRAS-PORTFOLIO (public bucket) ──────────────────────────

CREATE POLICY "storage_obras_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'obras-portfolio');

CREATE POLICY "storage_obras_insert_admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'obras-portfolio'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_obras_update_admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'obras-portfolio'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_obras_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'obras-portfolio'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- ── WA-ATTACHMENTS (public bucket) ───────────────────────────

CREATE POLICY "storage_wa_attach_select_public"
ON storage.objects FOR SELECT
USING (bucket_id = 'wa-attachments');

CREATE POLICY "storage_wa_attach_insert_auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wa-attachments'
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_wa_attach_delete_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'wa-attachments'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- ── CONTAS-LUZ (private bucket) ──────────────────────────────

-- Admin: full access within tenant
CREATE POLICY "storage_contas_luz_all_admin"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'contas-luz'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'contas-luz'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- Vendedor: read within tenant
CREATE POLICY "storage_contas_luz_select_vendedor"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contas-luz'
  AND has_role(auth.uid(), 'vendedor')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- Vendedor: upload within tenant
CREATE POLICY "storage_contas_luz_insert_vendedor"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contas-luz'
  AND has_role(auth.uid(), 'vendedor')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- Anon: upload only (public lead form) — path must have a valid UUID as first segment
-- Note: anon can't validate tenant, but files are private (signed URLs only)
CREATE POLICY "storage_contas_luz_insert_anon"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'contas-luz'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND length((storage.foldername(name))[1]) = 36
);

-- ── LEAD-ARQUIVOS (private bucket) ───────────────────────────

CREATE POLICY "storage_lead_arquivos_all_admin"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'lead-arquivos'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'lead-arquivos'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_lead_arquivos_select_vendedor"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lead-arquivos'
  AND has_role(auth.uid(), 'vendedor')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_lead_arquivos_insert_anon"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'lead-arquivos'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND length((storage.foldername(name))[1]) = 36
);

-- ── DOCUMENTOS-CLIENTES (private bucket) ─────────────────────

CREATE POLICY "storage_doc_clientes_all_admin"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'documentos-clientes'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'documentos-clientes'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_doc_clientes_select_vendedor"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos-clientes'
  AND has_role(auth.uid(), 'vendedor')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_doc_clientes_insert_vendedor"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos-clientes'
  AND has_role(auth.uid(), 'vendedor')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- ── CHECKLIST-ASSETS (private bucket) ────────────────────────

CREATE POLICY "storage_checklist_all_admin"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'checklist-assets'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'checklist-assets'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

-- Instalador: read/write own files within tenant
CREATE POLICY "storage_checklist_select_instalador"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'checklist-assets'
  AND has_role(auth.uid(), 'instalador')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_checklist_insert_instalador"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checklist-assets'
  AND has_role(auth.uid(), 'instalador')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ── COMPROVANTES (private bucket) ────────────────────────────

CREATE POLICY "storage_comprovantes_all_admin"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
)
WITH CHECK (
  bucket_id = 'comprovantes'
  AND is_admin(auth.uid())
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_comprovantes_select_financeiro"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprovantes'
  AND has_role(auth.uid(), 'financeiro')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);

CREATE POLICY "storage_comprovantes_insert_financeiro"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes'
  AND has_role(auth.uid(), 'financeiro')
  AND (storage.foldername(name))[1] = get_user_tenant_id()::text
);