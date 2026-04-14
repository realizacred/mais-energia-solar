INSERT INTO public.proposta_templates (id, tenant_id, nome, descricao, grupo, categoria, tipo, template_html, ativo, ordem)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '17de8315-2e2f-4a79-8751-e5d507d69a41',
  'Alta Conversão',
  'Landing page premium de alta conversão com Hero, KPIs, Antes vs Depois, Solução, Financeiro, Garantias, Pagamento e CTA.',
  'B',
  'geral',
  'html',
  NULL,
  true,
  1
)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = now();