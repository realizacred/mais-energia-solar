
-- P0-3: Anti-regressão — Forçar NOT NULL em tenant_id de tabelas críticas
-- SEGURO: Já confirmado 0 rows com tenant_id NULL em todas essas tabelas

-- Leads
ALTER TABLE public.leads ALTER COLUMN tenant_id SET NOT NULL;

-- Orçamentos
ALTER TABLE public.orcamentos ALTER COLUMN tenant_id SET NOT NULL;

-- Clientes
ALTER TABLE public.clientes ALTER COLUMN tenant_id SET NOT NULL;

-- Profiles
ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;

-- Vendedores
ALTER TABLE public.vendedores ALTER COLUMN tenant_id SET NOT NULL;

-- Propostas
ALTER TABLE public.propostas ALTER COLUMN tenant_id SET NOT NULL;

-- WA Conversations
ALTER TABLE public.wa_conversations ALTER COLUMN tenant_id SET NOT NULL;

-- WA Instances
ALTER TABLE public.wa_instances ALTER COLUMN tenant_id SET NOT NULL;

-- WA Reads
ALTER TABLE public.wa_reads ALTER COLUMN tenant_id SET NOT NULL;

-- WA Transfers
ALTER TABLE public.wa_transfers ALTER COLUMN tenant_id SET NOT NULL;

-- WA Webhook Events
ALTER TABLE public.wa_webhook_events ALTER COLUMN tenant_id SET NOT NULL;

-- ============================================================
-- P0-1 & P0-2: Migrar RLS de clientes e orcamentos de texto → UUID
-- ============================================================

-- P0-1: Clientes — vendedor SELECT por UUID via lead_id → leads.vendedor_id
DROP POLICY IF EXISTS "rls_clientes_select_vendedor" ON public.clientes;
CREATE POLICY "rls_clientes_select_vendedor" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND lead_id IN (
      SELECT l.id FROM leads l
      WHERE l.tenant_id = get_user_tenant_id()
        AND l.vendedor_id IN (
          SELECT v.id FROM vendedores v
          WHERE v.user_id = auth.uid()
            AND v.tenant_id = get_user_tenant_id()
            AND v.ativo = true
        )
    )
  );

-- P0-2: Orçamentos — SELECT vendedor por UUID
DROP POLICY IF EXISTS "rls_orcamentos_select_vendedor" ON public.orcamentos;
CREATE POLICY "rls_orcamentos_select_vendedor" ON public.orcamentos
  FOR SELECT TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid()
        AND v.tenant_id = get_user_tenant_id()
        AND v.ativo = true
    )
  );

-- P0-2: Orçamentos — UPDATE vendedor por UUID
DROP POLICY IF EXISTS "rls_orcamentos_update_vendedor" ON public.orcamentos;
CREATE POLICY "rls_orcamentos_update_vendedor" ON public.orcamentos
  FOR UPDATE TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid()
        AND v.tenant_id = get_user_tenant_id()
        AND v.ativo = true
    )
  )
  WITH CHECK (
    tenant_id = get_user_tenant_id()
  );

-- P0-2: Orçamentos — DELETE vendedor por UUID
DROP POLICY IF EXISTS "rls_orcamentos_delete_vendedor" ON public.orcamentos;
CREATE POLICY "rls_orcamentos_delete_vendedor" ON public.orcamentos
  FOR DELETE TO authenticated
  USING (
    tenant_id = get_user_tenant_id()
    AND vendedor_id IN (
      SELECT v.id FROM vendedores v
      WHERE v.user_id = auth.uid()
        AND v.tenant_id = get_user_tenant_id()
        AND v.ativo = true
    )
  );

-- ============================================================
-- P1-2: Remover policy duplicada em wa_instance_vendedores
-- ============================================================
DROP POLICY IF EXISTS "wa_instance_vendedores_service_role" ON public.wa_instance_vendedores;

-- ============================================================
-- P1-3: Adicionar policies explícitas para tabelas service_role only
-- ============================================================
-- edge_rate_limits: service_role only
CREATE POLICY "rls_edge_rate_limits_service" ON public.edge_rate_limits
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- push_sent_log: service_role only  
CREATE POLICY "rls_push_sent_log_service" ON public.push_sent_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
