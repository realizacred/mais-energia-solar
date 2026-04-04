
-- Função universal de proteção de tenant
CREATE OR REPLACE FUNCTION public.enforce_tenant_isolation()
RETURNS TRIGGER AS $$
DECLARE
  current_tenant uuid;
BEGIN
  -- Resolver tenant do usuário atual
  current_tenant := public.get_user_tenant_id(auth.uid());
  
  -- Se não tem tenant resolvido (service role / cron), bypass
  IF current_tenant IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Se tenant_id não foi informado ou é o global placeholder
  IF NEW.tenant_id IS NULL OR 
     NEW.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid THEN
    NEW.tenant_id := current_tenant;
    RETURN NEW;
  END IF;
  
  -- Se tenant_id é de outro tenant — BLOQUEAR
  IF NEW.tenant_id != current_tenant THEN
    RAISE EXCEPTION 
      'Violação de isolamento de tenant: tentativa de inserir dados no tenant % pelo usuário do tenant %',
      NEW.tenant_id, current_tenant;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar triggers em todas as tabelas críticas
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'leads', 'orcamentos', 'clientes', 'projetos',
    'deals', 'propostas_nativas', 'proposta_versoes',
    'recebimentos', 'pagamentos', 'parcelas',
    'consultores', 'concessionarias',
    'wa_conversations', 'wa_messages',
    'solar_market_proposals', 'solar_market_projects',
    'solar_market_clients', 'solar_market_funnels',
    'lancamentos_financeiros', 'comissoes',
    'visitas_tecnicas', 'obras', 'checklists_instalador',
    'proposta_templates', 'integration_configs',
    'financiamento_bancos', 'contacts'
  ])
  LOOP
    -- Verificar se a tabela existe antes de criar trigger
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = tbl AND n.nspname = 'public' AND c.relkind = 'r') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_tenant_%I ON %I', tbl, tbl);
      EXECUTE format('CREATE TRIGGER trg_enforce_tenant_%I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_isolation()', tbl, tbl);
    END IF;
  END LOOP;
END $$;
