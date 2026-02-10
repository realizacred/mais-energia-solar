
-- =============================================
-- LIMPEZA DE DADOS OPERACIONAIS (v4 - TRUNCATE CASCADE)
-- =============================================

-- Desabilitar triggers temporariamente para performance
SET session_replication_role = 'replica';

-- Tabelas financeiras e dependentes
TRUNCATE public.pagamentos_comissao CASCADE;
TRUNCATE public.pagamentos CASCADE;
TRUNCATE public.parcelas CASCADE;
TRUNCATE public.comissoes CASCADE;
TRUNCATE public.recebimentos CASCADE;

-- Serviços agendados
TRUNCATE public.servicos_agendados CASCADE;

-- Checklists
TRUNCATE public.checklist_instalador_arquivos CASCADE;
TRUNCATE public.checklist_instalador_respostas CASCADE;
TRUNCATE public.checklists_instalador CASCADE;
TRUNCATE public.checklist_cliente_arquivos CASCADE;
TRUNCATE public.checklist_cliente_respostas CASCADE;
TRUNCATE public.checklists_cliente CASCADE;
TRUNCATE public.checklists_instalacao CASCADE;

-- Projetos e Clientes
TRUNCATE public.projetos CASCADE;
TRUNCATE public.clientes CASCADE;

-- Simulações e Orçamentos
TRUNCATE public.simulacoes CASCADE;
TRUNCATE public.orcamentos CASCADE;

-- Leads
TRUNCATE public.leads CASCADE;

-- Dados analíticos
TRUNCATE public.ai_insights CASCADE;
TRUNCATE public.audit_logs CASCADE;

-- Reabilitar triggers
SET session_replication_role = 'origin';
