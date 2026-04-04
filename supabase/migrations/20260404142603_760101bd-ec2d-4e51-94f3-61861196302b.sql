
-- leads
DROP TRIGGER IF EXISTS trg_enforce_tenant_leads ON leads;
CREATE TRIGGER trg_enforce_tenant_leads BEFORE INSERT OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- orcamentos
DROP TRIGGER IF EXISTS trg_enforce_tenant_orcamentos ON orcamentos;
CREATE TRIGGER trg_enforce_tenant_orcamentos BEFORE INSERT OR UPDATE ON orcamentos FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- clientes
DROP TRIGGER IF EXISTS trg_enforce_tenant_clientes ON clientes;
CREATE TRIGGER trg_enforce_tenant_clientes BEFORE INSERT OR UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- projetos
DROP TRIGGER IF EXISTS trg_enforce_tenant_projetos ON projetos;
CREATE TRIGGER trg_enforce_tenant_projetos BEFORE INSERT OR UPDATE ON projetos FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- deals
DROP TRIGGER IF EXISTS trg_enforce_tenant_deals ON deals;
CREATE TRIGGER trg_enforce_tenant_deals BEFORE INSERT OR UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- propostas_nativas
DROP TRIGGER IF EXISTS trg_enforce_tenant_propostas_nativas ON propostas_nativas;
CREATE TRIGGER trg_enforce_tenant_propostas_nativas BEFORE INSERT OR UPDATE ON propostas_nativas FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- proposta_versoes
DROP TRIGGER IF EXISTS trg_enforce_tenant_proposta_versoes ON proposta_versoes;
CREATE TRIGGER trg_enforce_tenant_proposta_versoes BEFORE INSERT OR UPDATE ON proposta_versoes FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- recebimentos
DROP TRIGGER IF EXISTS trg_enforce_tenant_recebimentos ON recebimentos;
CREATE TRIGGER trg_enforce_tenant_recebimentos BEFORE INSERT OR UPDATE ON recebimentos FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- pagamentos
DROP TRIGGER IF EXISTS trg_enforce_tenant_pagamentos ON pagamentos;
CREATE TRIGGER trg_enforce_tenant_pagamentos BEFORE INSERT OR UPDATE ON pagamentos FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- parcelas
DROP TRIGGER IF EXISTS trg_enforce_tenant_parcelas ON parcelas;
CREATE TRIGGER trg_enforce_tenant_parcelas BEFORE INSERT OR UPDATE ON parcelas FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- consultores
DROP TRIGGER IF EXISTS trg_enforce_tenant_consultores ON consultores;
CREATE TRIGGER trg_enforce_tenant_consultores BEFORE INSERT OR UPDATE ON consultores FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- concessionarias
DROP TRIGGER IF EXISTS trg_enforce_tenant_concessionarias ON concessionarias;
CREATE TRIGGER trg_enforce_tenant_concessionarias BEFORE INSERT OR UPDATE ON concessionarias FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- wa_conversations
DROP TRIGGER IF EXISTS trg_enforce_tenant_wa_conversations ON wa_conversations;
CREATE TRIGGER trg_enforce_tenant_wa_conversations BEFORE INSERT OR UPDATE ON wa_conversations FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- wa_messages
DROP TRIGGER IF EXISTS trg_enforce_tenant_wa_messages ON wa_messages;
CREATE TRIGGER trg_enforce_tenant_wa_messages BEFORE INSERT OR UPDATE ON wa_messages FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- lancamentos_financeiros
DROP TRIGGER IF EXISTS trg_enforce_tenant_lancamentos_financeiros ON lancamentos_financeiros;
CREATE TRIGGER trg_enforce_tenant_lancamentos_financeiros BEFORE INSERT OR UPDATE ON lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- comissoes
DROP TRIGGER IF EXISTS trg_enforce_tenant_comissoes ON comissoes;
CREATE TRIGGER trg_enforce_tenant_comissoes BEFORE INSERT OR UPDATE ON comissoes FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- proposta_templates
DROP TRIGGER IF EXISTS trg_enforce_tenant_proposta_templates ON proposta_templates;
CREATE TRIGGER trg_enforce_tenant_proposta_templates BEFORE INSERT OR UPDATE ON proposta_templates FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- integration_configs
DROP TRIGGER IF EXISTS trg_enforce_tenant_integration_configs ON integration_configs;
CREATE TRIGGER trg_enforce_tenant_integration_configs BEFORE INSERT OR UPDATE ON integration_configs FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- financiamento_bancos
DROP TRIGGER IF EXISTS trg_enforce_tenant_financiamento_bancos ON financiamento_bancos;
CREATE TRIGGER trg_enforce_tenant_financiamento_bancos BEFORE INSERT OR UPDATE ON financiamento_bancos FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- contacts
DROP TRIGGER IF EXISTS trg_enforce_tenant_contacts ON contacts;
CREATE TRIGGER trg_enforce_tenant_contacts BEFORE INSERT OR UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- solar_market_proposals
DROP TRIGGER IF EXISTS trg_enforce_tenant_solar_market_proposals ON solar_market_proposals;
CREATE TRIGGER trg_enforce_tenant_solar_market_proposals BEFORE INSERT OR UPDATE ON solar_market_proposals FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- solar_market_projects
DROP TRIGGER IF EXISTS trg_enforce_tenant_solar_market_projects ON solar_market_projects;
CREATE TRIGGER trg_enforce_tenant_solar_market_projects BEFORE INSERT OR UPDATE ON solar_market_projects FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- solar_market_clients
DROP TRIGGER IF EXISTS trg_enforce_tenant_solar_market_clients ON solar_market_clients;
CREATE TRIGGER trg_enforce_tenant_solar_market_clients BEFORE INSERT OR UPDATE ON solar_market_clients FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- solar_market_funnels
DROP TRIGGER IF EXISTS trg_enforce_tenant_solar_market_funnels ON solar_market_funnels;
CREATE TRIGGER trg_enforce_tenant_solar_market_funnels BEFORE INSERT OR UPDATE ON solar_market_funnels FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- visitas_tecnicas
DROP TRIGGER IF EXISTS trg_enforce_tenant_visitas_tecnicas ON visitas_tecnicas;
CREATE TRIGGER trg_enforce_tenant_visitas_tecnicas BEFORE INSERT OR UPDATE ON visitas_tecnicas FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- obras
DROP TRIGGER IF EXISTS trg_enforce_tenant_obras ON obras;
CREATE TRIGGER trg_enforce_tenant_obras BEFORE INSERT OR UPDATE ON obras FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();

-- checklists_instalador
DROP TRIGGER IF EXISTS trg_enforce_tenant_checklists_instalador ON checklists_instalador;
CREATE TRIGGER trg_enforce_tenant_checklists_instalador BEFORE INSERT OR UPDATE ON checklists_instalador FOR EACH ROW EXECUTE FUNCTION enforce_tenant_isolation();
