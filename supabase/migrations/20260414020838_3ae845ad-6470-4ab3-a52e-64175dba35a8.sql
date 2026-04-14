
-- Desativar todos os templates WEB existentes (preservar histórico)
UPDATE proposta_templates
SET ativo = false, updated_at = now()
WHERE tipo IN ('html', 'web') AND ativo = true;

-- Inserir template premium canônico "Alta Conversão"
INSERT INTO proposta_templates (
  id, tenant_id, nome, descricao, grupo, categoria, tipo, ativo, ordem, template_html
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '17de8315-2e2f-4a79-8751-e5d507d69a41',
  'Alta Conversão',
  'Template premium de alta conversão com hero, KPIs, comparação antes/depois, equipamentos, financeiro, garantias, pagamento e CTA final.',
  'B',
  'alta_conversao',
  'html',
  true,
  0,
  '[{"id":"blk-hero","type":"proposal_hero","content":"","parentId":null,"order":0,"style":{},"isVisible":true,"_proposalType":"grid"},{"id":"blk-kpis","type":"proposal_kpis","content":"","parentId":null,"order":1,"style":{},"isVisible":true,"_proposalType":"grid"},{"id":"blk-comparison","type":"proposal_comparison","content":"","parentId":null,"order":2,"style":{},"isVisible":true,"_proposalType":"grid"},{"id":"blk-equipment","type":"proposal_equipment","content":"","parentId":null,"order":3,"style":{},"isVisible":true,"_proposalType":"grid"},{"id":"blk-financial","type":"proposal_financial","content":"","parentId":null,"order":4,"style":{},"isVisible":true,"_proposalType":"grid"},{"id":"blk-guarantees","type":"proposal_guarantees","content":"","parentId":null,"order":5,"style":{},"isVisible":true,"_proposalType":"grid"},{"id":"blk-payment","type":"proposal_payment","content":"","parentId":null,"order":6,"style":{},"isVisible":true,"_proposalType":"grid"},{"id":"blk-cta","type":"proposal_cta","content":"","parentId":null,"order":7,"style":{},"isVisible":true,"_proposalType":"grid"}]'
) ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  categoria = EXCLUDED.categoria,
  tipo = EXCLUDED.tipo,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  template_html = EXCLUDED.template_html,
  updated_at = now();
