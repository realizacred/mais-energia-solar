
-- Fix proposta_versoes for Fabio Barral: promote KPI columns from final_snapshot
UPDATE public.proposta_versoes
SET
  link_pdf = final_snapshot->>'link_pdf',
  geracao_anual = (final_snapshot->>'geracao_anual')::numeric,
  tir = (final_snapshot->>'tir')::numeric,
  vpl = (final_snapshot->>'vpl')::numeric,
  consumo_mensal = (final_snapshot->>'consumo_mensal')::numeric,
  tarifa_distribuidora = (final_snapshot->>'tarifa_distribuidora')::numeric,
  economia_mensal_percent = (final_snapshot->>'economia_mensal_percent')::numeric,
  inflacao_energetica = (final_snapshot->>'inflacao_energetica')::numeric,
  perda_eficiencia_anual = (final_snapshot->>'perda_eficiencia_anual')::numeric,
  sobredimensionamento = (final_snapshot->>'sobredimensionamento')::numeric,
  custo_disponibilidade = (final_snapshot->>'custo_disponibilidade')::numeric,
  origem = 'solarmarket'
WHERE id = '6a149426-3586-491d-91c7-eea59d684055';

-- Fix projetos: enrich with SM equipment data
UPDATE public.projetos
SET
  tipo_instalacao = 'Metálico',
  modelo_inversor = 'SOLIS S6-GR1P5K-S',
  numero_inversores = 1,
  modelo_modulos = 'GOKIN SOLAR GK-4-66HTBD-610M',
  numero_modulos = 7,
  valor_equipamentos = 6926.02,
  valor_mao_obra = 3800,
  geracao_mensal_media_kwh = 463
WHERE id = 'ff68e847-2ae0-412b-8011-35c1562b243e';

-- Fix clientes: enrich with potencia and valor
UPDATE public.clientes
SET
  potencia_kwp = 4.27,
  valor_projeto = 10726.02
WHERE id = 'e8167a31-2c8e-4af2-ac7e-b6601d31096d'
  AND potencia_kwp IS NULL;
