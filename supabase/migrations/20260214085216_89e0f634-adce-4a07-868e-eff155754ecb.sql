-- ══════════════════════════════════════════════════════════════
-- TENANT SETTINGS: Adicionar campos de identidade e configuração
-- ══════════════════════════════════════════════════════════════

-- 1) Novos campos na tabela tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS tenant_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Comentários para documentação
COMMENT ON COLUMN public.tenants.inscricao_estadual IS 'Inscrição Estadual do tenant';
COMMENT ON COLUMN public.tenants.estado IS 'UF do tenant (ex: MG, SP)';
COMMENT ON COLUMN public.tenants.cidade IS 'Cidade sede do tenant';
COMMENT ON COLUMN public.tenants.tenant_config IS 'Configurações dinâmicas do tenant (CRM rules, etc). Estrutura: {"crm": {"block_duplicate_clients": bool, "required_fields": [...]}}';

-- 3) Policy de UPDATE para admin do tenant (não existia)
CREATE POLICY "Admin can update own tenant"
  ON public.tenants
  FOR UPDATE
  USING (id = get_user_tenant_id(auth.uid()) AND is_admin(auth.uid()))
  WITH CHECK (id = get_user_tenant_id(auth.uid()) AND is_admin(auth.uid()));