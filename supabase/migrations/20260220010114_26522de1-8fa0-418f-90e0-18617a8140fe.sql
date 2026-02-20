
-- Fix: Allow users to see chats they created (needed for INSERT...RETURNING)
DROP POLICY IF EXISTS "Members view own chats" ON public.internal_chats;

CREATE POLICY "Members view own chats" ON public.internal_chats
FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR id IN (SELECT get_user_chat_ids(auth.uid()))
  )
);
