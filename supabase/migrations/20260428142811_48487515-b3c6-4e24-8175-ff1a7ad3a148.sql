-- Remover stubs `ignore` que foram inseridos automaticamente pela migration
-- 20260428032630, restabelecendo o estado "sem mapeamento" para que o admin
-- possa escolher a ação correta na UI de mapeamento (map / create_new / map_native).
-- Mantém apenas linhas que têm decisão real do usuário (action != 'ignore' ou created_by não nulo).

DELETE FROM public.sm_custom_field_mapping
WHERE tenant_id = '17de8315-2e2f-4a79-8751-e5d507d69a41'
  AND action = 'ignore'
  AND created_by IS NULL
  AND sm_field_key IN (
    'cap_concessionaria','cap_data_instal','cap_data_aprovacao',
    'cap_data_troca_medidor','cap_compensacao','cap_uc','cap_docs',
    'cap_vendedor','cap_boleto','capo_limpeza','capo_tempogarantia',
    'capo_obs_servico_1','capo_obs_servico_2','capo_obs_servico_3',
    'capo_obs_servico_4','capo_obs_servico_5'
  );