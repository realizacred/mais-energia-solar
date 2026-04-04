
DO $$
DECLARE
  tabelas text[] := ARRAY[
    'leads', 'orcamentos', 'clientes', 'projetos',
    'deals', 'propostas_nativas', 'proposta_versoes',
    'recebimentos', 'pagamentos', 'parcelas',
    'consultores', 'concessionarias',
    'wa_conversations', 'wa_messages',
    'lancamentos_financeiros', 'comissoes',
    'proposta_templates', 'integration_configs',
    'financiamento_bancos', 'contacts',
    'solar_market_proposals', 'solar_market_projects',
    'solar_market_clients', 'solar_market_funnels',
    'visitas_tecnicas', 'obras',
    'checklists_instalador'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY tabelas
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = tbl
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_enforce_tenant_%I ON %I',
        tbl, tbl
      );
      EXECUTE format(
        'CREATE TRIGGER trg_enforce_tenant_%I
         BEFORE INSERT OR UPDATE ON %I
         FOR EACH ROW
         EXECUTE FUNCTION enforce_tenant_isolation()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;
