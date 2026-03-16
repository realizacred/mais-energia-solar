
INSERT INTO public.proposal_charts (tenant_id, name, placeholder, chart_type, engine, data_source, label_field, value_field, title, subtitle, colors, chart_options, width, height, show_legend, show_grid, show_labels, active)
SELECT 
  t.id,
  d.name, d.placeholder, d.chart_type::chart_type, d.engine::chart_engine,
  d.data_source, d.label_field, d.value_field, d.title, d.subtitle,
  d.colors::jsonb, d.chart_options::jsonb,
  d.width, d.height, d.show_legend, d.show_grid, d.show_labels, d.active
FROM tenants t
CROSS JOIN (VALUES
  ('Geração Mensal', 'grafico_geracao_mensal', 'bar', 'rendered_image', 'tabelas.geracao_mensal', 'mes', 'valor', 'Geração Mensal Estimada', 'kWh por mês', '["#3b82f6"]', '{}', 1600, 900, false, true, true, true),
  ('Economia Mensal', 'grafico_economia_mensal', 'bar', 'rendered_image', 'tabelas.economia_mensal', 'mes', 'valor', 'Economia Mensal Estimada', 'R$ por mês', '["#10b981"]', '{}', 1600, 900, false, true, true, true),
  ('Comparação do Investimento', 'vc_grafico_de_comparacao', 'bar', 'rendered_image', 'tabelas.comparacao_investimento', 'item', 'valor', 'Comparação de Custos', NULL, '["#ef4444","#3b82f6","#f59e0b","#8b5cf6","#06b6d4"]', '{}', 1600, 900, true, true, true, true),
  ('Fluxo de Caixa Acumulado', 's_fluxo_caixa_acumulado_anual', 'bar', 'rendered_image', 'tabelas.fluxo_caixa', 'ano', 'valor', 'Fluxo de Caixa Acumulado', 'Retorno do investimento', '["#f59e0b","#3b82f6"]', '{"negativeColor":"#f59e0b","positiveColor":"#3b82f6"}', 1600, 900, true, true, true, true)
) AS d(name, placeholder, chart_type, engine, data_source, label_field, value_field, title, subtitle, colors, chart_options, width, height, show_legend, show_grid, show_labels, active)
WHERE t.ativo = true
AND NOT EXISTS (
  SELECT 1 FROM proposal_charts pc WHERE pc.tenant_id = t.id AND pc.placeholder = d.placeholder
);
