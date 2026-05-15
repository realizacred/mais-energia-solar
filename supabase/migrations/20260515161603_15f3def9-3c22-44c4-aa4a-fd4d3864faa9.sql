-- Fix search_path for security hardening
ALTER FUNCTION public.get_current_tenant_id() SET search_path = public;
ALTER FUNCTION public.fn_log_analise_credito_status_change() SET search_path = public;

-- Verify policies are correctly applied (redundant if they are already there, but safe)
DO $$
BEGIN
    -- Ensure policies exist for all new tables
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_bank_configs' AND policyname = 'Users can view bank configs from their tenant') THEN
        CREATE POLICY "Users can view bank configs from their tenant" ON public.credit_bank_configs FOR SELECT USING (tenant_id = public.get_current_tenant_id());
    END IF;
    -- (Other policies were already defined in the previous migration, so this is mostly a check)
END $$;
