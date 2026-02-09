-- FIX: wa_conversation_tags admin policy missing tenant filter
-- This allows admins from tenant A to manage tags on tenant B conversations

-- Drop the insecure admin policy
DROP POLICY IF EXISTS "Admins can manage wa_conversation_tags" ON wa_conversation_tags;

-- Create tenant-scoped admin policy
CREATE POLICY "rls_wa_conversation_tags_all_admin"
ON wa_conversation_tags
FOR ALL
TO authenticated
USING (
  is_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM wa_conversations wc 
    WHERE wc.id = wa_conversation_tags.conversation_id 
    AND wc.tenant_id = get_user_tenant_id()
  )
)
WITH CHECK (
  is_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM wa_conversations wc 
    WHERE wc.id = wa_conversation_tags.conversation_id 
    AND wc.tenant_id = get_user_tenant_id()
  )
);

-- Also fix the vendor policy to include tenant check through conversation
DROP POLICY IF EXISTS "Vendors can manage tags on accessible conversations" ON wa_conversation_tags;

CREATE POLICY "rls_wa_conversation_tags_all_vendor"
ON wa_conversation_tags
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM wa_conversations wc
    JOIN wa_instances wi ON wi.id = wc.instance_id
    WHERE wc.id = wa_conversation_tags.conversation_id
    AND wc.tenant_id = get_user_tenant_id()
    AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM wa_conversations wc
    JOIN wa_instances wi ON wi.id = wc.instance_id
    WHERE wc.id = wa_conversation_tags.conversation_id
    AND wc.tenant_id = get_user_tenant_id()
    AND (wi.owner_user_id = auth.uid() OR wc.assigned_to = auth.uid())
  )
);