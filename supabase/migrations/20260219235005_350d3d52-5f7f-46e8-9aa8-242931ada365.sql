
-- Ensure no leftover policy
DROP POLICY IF EXISTS "contacts_select_tenant" ON public.contacts;

-- Admins see all tenant contacts; consultors see only contacts from their assigned conversations
CREATE POLICY "contacts_select_tenant" ON public.contacts
FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    is_admin(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM wa_conversations wc
      JOIN consultores c ON c.id = wc.assigned_to
      WHERE c.user_id = auth.uid()
        AND wc.tenant_id = contacts.tenant_id
        AND wc.cliente_telefone = contacts.phone_e164
    )
  )
);
