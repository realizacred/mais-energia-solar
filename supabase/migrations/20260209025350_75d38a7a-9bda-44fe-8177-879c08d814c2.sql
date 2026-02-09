-- Allow authenticated users to read leads linked to their WA conversations
CREATE POLICY "Users can read leads linked to their wa_conversations"
ON public.leads
FOR SELECT
USING (
  id IN (
    SELECT wc.lead_id 
    FROM wa_conversations wc 
    WHERE wc.lead_id = leads.id
    AND (
      wc.assigned_to = auth.uid()
      OR is_admin(auth.uid())
    )
  )
);