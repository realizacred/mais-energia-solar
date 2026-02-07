
-- Insert default WhatsApp automation config
INSERT INTO public.whatsapp_automation_config (
  ativo, 
  webhook_url, 
  api_token, 
  lembrete_dias, 
  lembrete_ativo, 
  mensagem_boas_vindas, 
  mensagem_followup, 
  modo_envio, 
  automacoes_ativas
) VALUES (
  false,
  null,
  null,
  3,
  true,
  'Olá {nome}! Sou {vendedor}, da Mais Energia Solar. Recebi seu interesse em energia solar e gostaria de te ajudar a economizar na conta de luz! Posso te enviar uma proposta personalizada?',
  'Olá {nome}! Tudo bem? Sou {vendedor} da Mais Energia Solar. Gostaria de saber se você ainda tem interesse em energia solar. Posso esclarecer alguma dúvida ou enviar uma proposta atualizada?',
  'webhook',
  false
);

-- Insert default automation templates
INSERT INTO public.whatsapp_automation_templates (nome, tipo, gatilho_config, mensagem, ativo, ordem) VALUES
(
  'Boas-vindas ao novo lead',
  'boas_vindas',
  '{"delay_minutos": 5}',
  'Olá {nome}! 👋 Aqui é da *Mais Energia Solar*! Recebemos seu interesse em energia solar para {cidade}/{estado}. Com seu consumo de {consumo} kWh, você pode economizar muito! Vou preparar uma proposta personalizada para você. 😊',
  true,
  1
),
(
  'Lead mudou para Orçamento Enviado',
  'mudanca_status',
  '{"status_destino": "Orçamento Enviado"}',
  'Olá {nome}! 📋 Acabei de enviar o orçamento do seu projeto de energia solar. Dê uma olhada com calma e me avise se tiver alguma dúvida. Estou à disposição! ☀️',
  true,
  2
),
(
  'Lead mudou para Visita Agendada',
  'mudanca_status',
  '{"status_destino": "Visita Agendada"}',
  'Olá {nome}! 📅 Sua visita técnica foi agendada! Nossa equipe irá até o local para avaliar a melhor solução de energia solar para você. Qualquer dúvida, estou aqui! 🔧',
  true,
  3
),
(
  'Lembrete de inatividade (3 dias)',
  'inatividade',
  '{"dias_sem_contato": 3}',
  'Olá {nome}! 😊 Fazem alguns dias que conversamos sobre energia solar. Gostaria de saber se surgiu alguma dúvida ou se posso te ajudar com mais informações. A economia na conta de luz pode começar logo! ☀️',
  true,
  4
),
(
  'Lembrete de inatividade (7 dias)',
  'inatividade',
  '{"dias_sem_contato": 7}',
  'Olá {nome}! Passando para lembrar que temos condições especiais para seu projeto de energia solar em {cidade}. Posso te enviar uma proposta atualizada? 💡',
  true,
  5
),
(
  'Confirmação de agendamento',
  'agendamento',
  '{"horas_antes": 24}',
  'Olá {nome}! 📌 Lembrando que amanhã temos um compromisso agendado referente ao seu projeto de energia solar. Confirma sua disponibilidade? Estamos ansiosos para te atender! ⚡',
  true,
  6
);
