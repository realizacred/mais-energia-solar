-- =====================================================
-- SECURITY FIX: Restrict webhook management to admins only
-- =====================================================

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage webhooks" ON public.webhook_config;

-- Add admin-only policy for managing webhooks
CREATE POLICY "Admin pode gerenciar webhooks"
ON public.webhook_config
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Keep read access for authenticated users (to see webhook status)
CREATE POLICY "Usuários autenticados podem ver webhooks"
ON public.webhook_config
FOR SELECT
USING (auth.role() = 'authenticated');

-- =====================================================
-- SECURITY FIX: Make audit logs explicitly immutable
-- =====================================================

-- Explicitly deny UPDATE operations on audit logs
CREATE POLICY "Audit logs são imutáveis - sem UPDATE"
ON public.audit_logs
FOR UPDATE
USING (false)
WITH CHECK (false);

-- Explicitly deny DELETE operations on audit logs
CREATE POLICY "Audit logs são imutáveis - sem DELETE"
ON public.audit_logs
FOR DELETE
USING (false);