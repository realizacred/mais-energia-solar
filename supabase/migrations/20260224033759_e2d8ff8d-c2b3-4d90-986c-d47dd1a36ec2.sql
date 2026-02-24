
-- Step 1: Delete all existing redundant rules
DELETE FROM wa_followup_rules WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Step 2: Insert 5 optimized rules for solar company
INSERT INTO wa_followup_rules (tenant_id, nome, descricao, cenario, prazo_minutos, prioridade, mensagem_template, envio_automatico, max_tentativas, status_conversa, ativo, ordem) VALUES

-- Rule 1: SLA Alert (15min) - Internal team notification only
('00000000-0000-0000-0000-000000000001',
 'Alerta SLA - Equipe sem resposta 15min',
 'Alerta interno para gestores quando a equipe não responde em 15 minutos. Não envia mensagem ao cliente.',
 'equipe_sem_resposta', 15, 'urgente', NULL,
 false, 1, ARRAY['aberta','em_andamento'], true, 1),

-- Rule 2: Auto-Apology (1h) - Automatic message if team still silent
('00000000-0000-0000-0000-000000000001',
 'Pedido de desculpas automático - 1h',
 'Se a equipe não respondeu em 1h, envia pedido de desculpas automático ao cliente.',
 'equipe_sem_resposta', 60, 'alta',
 'Olá! Pedimos desculpas pela demora no retorno. 🙏 Nossa equipe já está analisando sua solicitação sobre energia solar e em breve retornaremos com todas as informações. Agradecemos sua paciência! ☀️',
 true, 1, ARRAY['aberta','em_andamento'], true, 2),

-- Rule 3: Initial Follow-up (2h) - Check-in with customer
('00000000-0000-0000-0000-000000000001',
 'Follow-up inicial - Cliente sem resposta 2h',
 'Primeiro contato de follow-up quando o cliente não responde em 2h. Tom consultivo e focado em dúvidas.',
 'cliente_sem_resposta', 120, 'alta',
 'Olá! 😊 Vi que conversamos sobre energia solar recentemente. Gostaria de saber se ficou alguma dúvida sobre a proposta ou sobre como funciona o sistema fotovoltaico? Estou à disposição para esclarecer! ☀️',
 true, 1, ARRAY['aberta','em_andamento'], true, 3),

-- Rule 4: Value/Nurturing (24h) - Add value, not just "checking in"
('00000000-0000-0000-0000-000000000001',
 'Follow-up de valor - 24h',
 'Mensagem de nutrição com informação útil sobre economia solar. Evita tom de cobrança.',
 'cliente_sem_resposta', 1440, 'media',
 'Olá! 🌞 Passando para compartilhar: clientes na sua região estão economizando em média 90% na conta de luz com energia solar. O investimento se paga em cerca de 3-4 anos e o sistema dura mais de 25! Se quiser, posso preparar uma simulação personalizada para você. ⚡💰',
 true, 1, ARRAY['aberta','em_andamento'], true, 4),

-- Rule 5: Reactivation (5 days) - Last attempt for stalled conversations  
('00000000-0000-0000-0000-000000000001',
 'Reativação - Conversa parada 5 dias',
 'Última tentativa de reativação para conversas paradas. Tom leve e sem pressão.',
 'conversa_parada', 7200, 'baixa',
 'Olá! Tudo bem? 😊 Faz alguns dias que conversamos sobre energia solar. Entendo que é uma decisão importante! Caso queira retomar, temos condições especiais este mês e posso fazer uma visita técnica sem compromisso. É só me chamar! ☀️🏠',
 true, 1, ARRAY['aberta','em_andamento','parada'], true, 5);
