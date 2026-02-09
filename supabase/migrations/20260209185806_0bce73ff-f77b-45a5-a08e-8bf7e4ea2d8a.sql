INSERT INTO wa_followup_rules (tenant_id, nome, cenario, prazo_horas, max_tentativas, mensagem_template, envio_automatico, ativo, status_conversa, ordem)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Alerta - Equipe sem resposta 2min',
  'equipe_sem_resposta',
  0.0333,
  1,
  NULL,
  false,
  true,
  ARRAY['open'],
  0
);