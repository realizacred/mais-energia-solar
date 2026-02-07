-- =============================================
-- 1. APPROVAL FLOW: Add columns to profiles
-- =============================================
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS cargo_solicitado text;

-- Mark existing users as already approved
UPDATE profiles SET status = 'aprovado' WHERE status IS NULL OR status = 'aprovado';

-- =============================================
-- 2. DATABASE DOCUMENTATION: Comments on all tables
-- =============================================

-- Core Auth & Users
COMMENT ON TABLE profiles IS 'Perfis de usuários do sistema (dados adicionais além do auth.users)';
COMMENT ON COLUMN profiles.status IS 'Status de aprovação: pendente, aprovado, rejeitado';
COMMENT ON COLUMN profiles.cargo_solicitado IS 'Cargo escolhido no signup (vendedor, instalador) - aguardando aprovação admin';

COMMENT ON TABLE user_roles IS 'Papéis/permissões dos usuários (admin, gerente, financeiro, vendedor, instalador)';

-- Leads & Sales Pipeline
COMMENT ON TABLE leads IS 'Leads captados via formulário público ou link de vendedor';
COMMENT ON TABLE lead_status IS 'Status possíveis para leads (ex: novo, em contato, fechado)';
COMMENT ON TABLE lead_atividades IS 'Histórico de atividades/follow-ups de cada lead';
COMMENT ON TABLE orcamentos IS 'Orçamentos gerados a partir de leads (múltiplos por lead)';

-- Clients & Projects
COMMENT ON TABLE clientes IS 'Clientes convertidos a partir de leads (pós-venda)';
COMMENT ON TABLE projetos IS 'Projetos de instalação solar vinculados a clientes';

-- Team Management
COMMENT ON TABLE vendedores IS 'Vendedores cadastrados com código de indicação único';
COMMENT ON TABLE comissoes IS 'Comissões calculadas para vendedores por projeto';
COMMENT ON TABLE pagamentos_comissao IS 'Pagamentos realizados de comissões aos vendedores';
COMMENT ON TABLE gamification_config IS 'Configuração global de metas e gamificação dos vendedores';
COMMENT ON TABLE meta_notifications IS 'Notificações de progresso de metas dos vendedores';

-- Financial
COMMENT ON TABLE recebimentos IS 'Recebimentos financeiros de clientes (acordos de pagamento)';
COMMENT ON TABLE parcelas IS 'Parcelas individuais dos recebimentos';
COMMENT ON TABLE pagamentos IS 'Pagamentos registrados contra recebimentos';
COMMENT ON TABLE financiamento_bancos IS 'Bancos e taxas para simulação de financiamento';
COMMENT ON TABLE financiamento_api_config IS 'Configuração de API para sincronizar taxas de financiamento';

-- Installation & Services
COMMENT ON TABLE servicos_agendados IS 'Serviços agendados para instaladores (instalação, manutenção, vistoria)';
COMMENT ON TABLE checklists_instalacao IS 'Checklists antigos de instalação (legado)';
COMMENT ON TABLE checklists_instalador IS 'Checklists do instalador por projeto (novo sistema com fases)';
COMMENT ON TABLE checklists_cliente IS 'Checklists de documentação do cliente';
COMMENT ON TABLE checklist_templates IS 'Templates de checklists reutilizáveis';
COMMENT ON TABLE checklist_template_items IS 'Itens/campos de cada template de checklist';
COMMENT ON TABLE checklist_instalador_respostas IS 'Respostas dos instaladores aos itens do checklist';
COMMENT ON TABLE checklist_instalador_arquivos IS 'Fotos e arquivos enviados nos checklists do instalador';
COMMENT ON TABLE checklist_cliente_respostas IS 'Respostas aos itens do checklist do cliente';
COMMENT ON TABLE checklist_cliente_arquivos IS 'Arquivos enviados nos checklists do cliente';
COMMENT ON TABLE layouts_solares IS 'Layouts de posicionamento de módulos solares no telhado';

-- Installer Performance
COMMENT ON TABLE instalador_config IS 'Configuração global de metas dos instaladores';
COMMENT ON TABLE instalador_metas IS 'Metas individuais por instalador';
COMMENT ON TABLE instalador_performance_mensal IS 'Performance mensal consolidada de cada instalador';

-- Equipment & Infrastructure
COMMENT ON TABLE disjuntores IS 'Catálogo de disjuntores disponíveis';
COMMENT ON TABLE concessionarias IS 'Concessionárias de energia elétrica';
COMMENT ON TABLE calculadora_config IS 'Configuração da calculadora solar pública';

-- Instagram Integration
COMMENT ON TABLE instagram_config IS 'Configuração de integração com Instagram';
COMMENT ON TABLE instagram_posts IS 'Posts sincronizados do Instagram para exibição no site';

-- Audit & Logs
COMMENT ON TABLE audit_logs IS 'Log de auditoria de ações administrativas no sistema';

-- =============================================
-- 3. RLS: Allow new users to insert their own profile on signup
-- =============================================
-- The existing policy "Users can insert own profile" already handles this.
-- Add policy so unapproved users can still read their own profile (to see pending status)
-- (Already covered by "Users can read own profile" policy)