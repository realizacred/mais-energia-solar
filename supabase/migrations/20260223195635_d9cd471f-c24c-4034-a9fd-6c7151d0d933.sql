
-- =====================================================
-- FASE 6: FINANCIAL FLOW HARDENING
-- =====================================================

-- ── 1) Fix commission_plans: role public → authenticated ──
DROP POLICY IF EXISTS "tenant_isolation_select" ON public.commission_plans;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.commission_plans;
DROP POLICY IF EXISTS "tenant_isolation_update" ON public.commission_plans;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON public.commission_plans;

CREATE POLICY "tenant_isolation_select" ON public.commission_plans
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id());
CREATE POLICY "tenant_isolation_insert" ON public.commission_plans
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "tenant_isolation_update" ON public.commission_plans
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));
CREATE POLICY "tenant_isolation_delete" ON public.commission_plans
  FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- ── 2) Fix proposta_versoes: role public → authenticated ──
DROP POLICY IF EXISTS "Users read own tenant versions" ON public.proposta_versoes;
DROP POLICY IF EXISTS "Users insert versions" ON public.proposta_versoes;
DROP POLICY IF EXISTS "Users update versions" ON public.proposta_versoes;
DROP POLICY IF EXISTS "Admins delete versions" ON public.proposta_versoes;

CREATE POLICY "Users read own tenant versions" ON public.proposta_versoes
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Users insert versions" ON public.proposta_versoes
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Users update versions" ON public.proposta_versoes
  FOR UPDATE TO authenticated 
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active())
  WITH CHECK (tenant_id = get_user_tenant_id() AND tenant_and_user_active());
CREATE POLICY "Admins delete versions" ON public.proposta_versoes
  FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()));

-- ── 3) Fix projetos: role public → authenticated (except read policies which stay) ──
DROP POLICY IF EXISTS "rls_projetos_all_admin" ON public.projetos;
DROP POLICY IF EXISTS "rls_projetos_select_consultor" ON public.projetos;
DROP POLICY IF EXISTS "rls_projetos_select_instalador" ON public.projetos;

CREATE POLICY "rls_projetos_all_admin" ON public.projetos
  FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active())
  WITH CHECK (tenant_id = get_user_tenant_id() AND is_admin(auth.uid()) AND tenant_and_user_active());

CREATE POLICY "rls_projetos_select_consultor" ON public.projetos
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active() AND consultor_id IN (
    SELECT v.id FROM consultores v WHERE v.user_id = auth.uid() AND v.tenant_id = get_user_tenant_id()
  ));

CREATE POLICY "rls_projetos_select_instalador" ON public.projetos
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id() AND tenant_and_user_active() AND instalador_id = auth.uid());

-- ── 4) Add updated_at triggers on financial tables ──

-- comissoes
CREATE TRIGGER trg_comissoes_updated_at
  BEFORE UPDATE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- proposta_versoes
CREATE TRIGGER trg_proposta_versoes_updated_at
  BEFORE UPDATE ON public.proposta_versoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- projetos (check if exists first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'projetos' AND p.proname IN ('set_updated_at', 'update_updated_at_column')
    AND NOT t.tgisinternal
  ) THEN
    CREATE TRIGGER trg_projetos_updated_at
      BEFORE UPDATE ON public.projetos
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── 5) Fix project_events: role public → authenticated + service_role ──
DROP POLICY IF EXISTS "System can insert project events" ON public.project_events;
DROP POLICY IF EXISTS "Tenant members can view project events" ON public.project_events;
DROP POLICY IF EXISTS "project_events immutable no update" ON public.project_events;
DROP POLICY IF EXISTS "project_events immutable no delete" ON public.project_events;

-- Authenticated users insert events (tenant-scoped)
CREATE POLICY "Authenticated users insert project events" ON public.project_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Service role can insert (for triggers/backend)
CREATE POLICY "Service role insert project events" ON public.project_events
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Tenant members can view
CREATE POLICY "Tenant members can view project events" ON public.project_events
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- Immutability preserved
CREATE POLICY "project_events immutable no update" ON public.project_events
  FOR UPDATE TO public USING (false);
CREATE POLICY "project_events immutable no delete" ON public.project_events
  FOR DELETE TO public USING (false);
