
-- 1) Limpar entradas corrompidas com colchetes literais
DELETE FROM sm_custom_field_mapping
WHERE tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND sm_field_key LIKE '[%]';

-- 2) Corrigir mapeamentos quebrados (map_native sem target / create_new sem ação) -> ignore
UPDATE sm_custom_field_mapping
SET action='ignore', crm_field_id=NULL, crm_native_target=NULL, crm_field_type=NULL
WHERE tenant_id='17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND sm_field_key IN ('cape_telhado','capo_i','capo_m','capo_mi','capo_overlord');

-- 3) Inserir mapeamentos faltantes para slugs sem destino no CRM (ignore = sem warning)
INSERT INTO sm_custom_field_mapping (tenant_id, sm_field_key, action)
SELECT '17de8315-2e2f-4a79-8751-e5d507d69a41', slug, 'ignore'
FROM (VALUES
  ('cap_concessionaria'),
  ('cap_data_instal'),
  ('cap_data_aprovacao'),
  ('cap_data_troca_medidor'),
  ('cap_compensacao'),
  ('cap_uc'),
  ('cap_docs'),
  ('cap_vendedor'),
  ('cap_boleto'),
  ('capo_limpeza'),
  ('capo_tempogarantia'),
  ('capo_obs_servico_1'),
  ('capo_obs_servico_2'),
  ('capo_obs_servico_3'),
  ('capo_obs_servico_4'),
  ('capo_obs_servico_5')
) AS t(slug)
ON CONFLICT (tenant_id, sm_field_key) DO NOTHING;
