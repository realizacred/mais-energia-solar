-- Inserir configuração padrão da calculadora solar
INSERT INTO public.calculadora_config (
  tarifa_media_kwh,
  custo_por_kwp,
  geracao_mensal_por_kwp,
  kg_co2_por_kwh,
  percentual_economia,
  vida_util_sistema
) VALUES (
  0.85,
  4500,
  120,
  0.084,
  95,
  25
) ON CONFLICT DO NOTHING;