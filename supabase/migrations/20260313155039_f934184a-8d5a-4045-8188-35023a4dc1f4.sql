
-- Allow consultors to update their own leads (status_id, updated_at)
CREATE POLICY "rls_leads_update_consultor"
  ON public.leads
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND tenant_and_user_active()
    AND consultor_id IN (
      SELECT v.id FROM consultores v
      WHERE v.user_id = auth.uid()
        AND v.tenant_id = get_user_tenant_id()
        AND v.ativo = true
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND tenant_and_user_active()
    AND consultor_id IN (
      SELECT v.id FROM consultores v
      WHERE v.user_id = auth.uid()
        AND v.tenant_id = get_user_tenant_id()
        AND v.ativo = true
    )
  );

-- Fix Robert's lead status to "Aguardando Validação"
UPDATE leads
SET status_id = '3828fe85-bbec-4cf7-872e-3f22623b40db',
    updated_at = now()
WHERE id = '5dd8979c-32e8-468b-80d1-d58bd2cbfe97'
  AND nome = 'Robert Gonçalves Alves';
