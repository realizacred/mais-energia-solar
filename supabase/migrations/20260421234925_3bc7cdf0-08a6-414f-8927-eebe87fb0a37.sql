-- FIX-04: documentar explicitamente que estas 4 tabelas são service-role only.
-- Service role bypassa RLS automaticamente, então não precisamos de policy permissiva.
-- Adicionamos uma policy "deny all" explícita para deixar a intenção clara
-- e evitar futuras tentativas de leitura via cliente autenticado.

-- billing_webhook_events: recebe payloads de Asaas/Stripe, processado por edge function
DROP POLICY IF EXISTS "service_role_only" ON public.billing_webhook_events;
CREATE POLICY "service_role_only"
ON public.billing_webhook_events
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.billing_webhook_events IS
'Service-role only. Acessada exclusivamente por edge functions de webhook (Asaas/Stripe).';

-- staging_clientes_map: tabela auxiliar de importação
DROP POLICY IF EXISTS "service_role_only" ON public.staging_clientes_map;
CREATE POLICY "service_role_only"
ON public.staging_clientes_map
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.staging_clientes_map IS
'Service-role only. Tabela de staging usada por jobs de importação.';

-- staging_import: tabela auxiliar de importação
DROP POLICY IF EXISTS "service_role_only" ON public.staging_import;
CREATE POLICY "service_role_only"
ON public.staging_import
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.staging_import IS
'Service-role only. Tabela de staging usada por jobs de importação.';

-- staging_importacao: tabela auxiliar de importação
DROP POLICY IF EXISTS "service_role_only" ON public.staging_importacao;
CREATE POLICY "service_role_only"
ON public.staging_importacao
AS RESTRICTIVE
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.staging_importacao IS
'Service-role only. Tabela de staging usada por jobs de importação.';