
-- ================================================================
-- FASE 1: wa_conversation_tags — adicionar tenant_id + backfill
-- ================================================================

-- 1. Adicionar coluna nullable
ALTER TABLE public.wa_conversation_tags
ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);

-- 2. Backfill via wa_conversations
UPDATE public.wa_conversation_tags wct
SET tenant_id = wc.tenant_id
FROM public.wa_conversations wc
WHERE wct.conversation_id = wc.id
  AND wct.tenant_id IS NULL;

-- 3. Tornar NOT NULL + default
ALTER TABLE public.wa_conversation_tags
ALTER COLUMN tenant_id SET NOT NULL,
ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- 4. Índice para performance RLS
CREATE INDEX idx_wa_conversation_tags_tenant_id
ON public.wa_conversation_tags(tenant_id);

-- 5. Drop policies antigas (JOIN-based)
DROP POLICY IF EXISTS "rls_wa_conversation_tags_all_admin" ON public.wa_conversation_tags;
DROP POLICY IF EXISTS "rls_wa_conversation_tags_all_vendor" ON public.wa_conversation_tags;

-- 6. Novas policies diretas (sem JOIN)
CREATE POLICY "rls_wa_conversation_tags_all_admin"
ON public.wa_conversation_tags
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND is_admin(auth.uid())
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND is_admin(auth.uid())
);

CREATE POLICY "rls_wa_conversation_tags_all_vendor"
ON public.wa_conversation_tags
FOR ALL
TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM wa_conversations wc
    WHERE wc.id = conversation_id
      AND can_access_wa_conversation(wc.id, auth.uid())
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM wa_conversations wc
    WHERE wc.id = conversation_id
      AND can_access_wa_conversation(wc.id, auth.uid())
  )
);
