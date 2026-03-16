-- Seed: Insert "Consumo Mensal" chart for all active tenants (idempotent)
INSERT INTO public.proposal_charts (tenant_id, name, placeholder, chart_type, engine, data_source, label_field, value_field, title, subtitle, colors, chart_options, width, height, show_legend, show_grid, show_labels, active)
SELECT 
  t.id,
  'Consumo Mensal', 'grafico_consumo_mensal', 'bar'::chart_type, 'rendered_image'::chart_engine,
  'tabelas.consumo_mensal', 'mes', 'valor', 'Consumo de Energia', 'kWh por mês',
  '["#ef4444"]'::jsonb, '{}'::jsonb,
  1600, 900, false, true, true, true
FROM tenants t
WHERE t.ativo = true
AND NOT EXISTS (
  SELECT 1 FROM proposal_charts pc WHERE pc.tenant_id = t.id AND pc.placeholder = 'grafico_consumo_mensal'
);

-- Update existing charts with new titles/subtitles per user spec
UPDATE public.proposal_charts SET 
  subtitle = 'Economia em R$'
WHERE placeholder = 'grafico_economia_mensal' AND (subtitle IS NULL OR subtitle = 'R$ por mês');

UPDATE public.proposal_charts SET 
  name = 'Comparação de Custos',
  subtitle = 'Antes e Depois da Energia Solar'
WHERE placeholder = 'vc_grafico_de_comparacao' AND subtitle IS NULL;

UPDATE public.proposal_charts SET 
  title = 'Retorno do Investimento',
  subtitle = 'Fluxo de caixa acumulado'
WHERE placeholder = 's_fluxo_caixa_acumulado_anual' AND (subtitle = 'Retorno do investimento' OR subtitle IS NULL);