
-- Temporary cleanup function to delete all projects and proposals
-- This is a one-time operation requested by admin

-- Delete in FK order
DELETE FROM proposta_versoes;
DELETE FROM propostas_nativas;
DELETE FROM project_events;
DELETE FROM generated_documents;
DELETE FROM deal_activities;
DELETE FROM deal_notes;
DELETE FROM comissoes;
DELETE FROM parcelas;
DELETE FROM checklist_cliente_arquivos;
DELETE FROM checklist_cliente_respostas;
DELETE FROM checklists_cliente;
DELETE FROM checklist_instalador_arquivos;
DELETE FROM checklist_instalador_respostas;
DELETE FROM checklists_instalador;
DELETE FROM projetos;
DELETE FROM deals;
