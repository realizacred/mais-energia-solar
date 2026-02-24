
-- Limpar regras atuais
DELETE FROM wa_followup_rules WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- ═══════════════════════════════════════════════════════════════
-- BLOCO A: ALERTAS INTERNOS (consultor/gerente vê, cliente NÃO vê)
-- ═══════════════════════════════════════════════════════════════

INSERT INTO wa_followup_rules (tenant_id, nome, descricao, cenario, prazo_minutos, prioridade, mensagem_template, envio_automatico, max_tentativas, status_conversa, ativo, ordem) VALUES

-- A1: Alerta interno 15min - Consultor
('00000000-0000-0000-0000-000000000001',
 '🔔 Alerta interno - Equipe sem resposta 15min',
 'Alerta interno para consultor/gerente. Cliente NÃO recebe nada. Aparece no painel de gestão como pendência urgente.',
 'equipe_sem_resposta', 15, 'urgente', NULL,
 false, 1, ARRAY['aberta','em_andamento'], true, 1),

-- A2: Alerta interno 1h - Escalação para gerente
('00000000-0000-0000-0000-000000000001',
 '🚨 Escalação gerente - Equipe sem resposta 1h',
 'Escalação interna para gerente quando consultor não respondeu em 1h. Cliente NÃO vê este alerta.',
 'equipe_sem_resposta', 60, 'urgente', NULL,
 false, 1, ARRAY['aberta','em_andamento'], true, 2),

-- A3: Alerta interno 24h - Cliente sem resposta (consultor precisa agir)
('00000000-0000-0000-0000-000000000001',
 '🔔 Alerta interno - Cliente sem resposta 24h',
 'Avisa o consultor que o cliente não respondeu em 24h. Consultor deve avaliar se liga ou muda abordagem. Cliente NÃO vê.',
 'cliente_sem_resposta', 1440, 'media', NULL,
 false, 1, ARRAY['aberta','em_andamento'], true, 6),

-- ═══════════════════════════════════════════════════════════════
-- BLOCO B: MENSAGENS AUTOMÁTICAS AO CLIENTE (cliente recebe no WhatsApp)
-- ═══════════════════════════════════════════════════════════════

-- B1: Pedido de desculpas automático 1h (equipe não respondeu)
('00000000-0000-0000-0000-000000000001',
 '💬 Auto: Desculpas pela demora - 1h',
 'Se equipe não respondeu em 1h, envia pedido de desculpas ao CLIENTE automaticamente via WhatsApp.',
 'equipe_sem_resposta', 60, 'alta',
 'Olá! Pedimos desculpas pela demora no retorno. 🙏 Nossa equipe já está analisando sua solicitação sobre energia solar e em breve retornaremos com todas as informações. Agradecemos sua paciência! ☀️',
 true, 1, ARRAY['aberta','em_andamento'], true, 3),

-- B2: Follow-up inicial 2h (cliente não respondeu)
('00000000-0000-0000-0000-000000000001',
 '💬 Auto: Follow-up inicial - 2h',
 'Primeiro follow-up ao CLIENTE que não respondeu em 2h. Tom consultivo focado em dúvidas.',
 'cliente_sem_resposta', 120, 'alta',
 'Olá! 😊 Vi que conversamos sobre energia solar recentemente. Ficou alguma dúvida sobre a proposta ou sobre como funciona o sistema fotovoltaico? Estou à disposição para esclarecer! ☀️',
 true, 1, ARRAY['aberta','em_andamento'], true, 4),

-- B3: Follow-up de valor 24h (cliente não respondeu)
('00000000-0000-0000-0000-000000000001',
 '💬 Auto: Follow-up de valor - 24h',
 'Mensagem de nutrição ao CLIENTE com informação útil sobre economia solar. Sem tom de cobrança.',
 'cliente_sem_resposta', 1440, 'media',
 'Olá! 🌞 Clientes na sua região estão economizando em média 90% na conta de luz com energia solar. O investimento se paga em cerca de 3-4 anos e o sistema dura mais de 25! Posso preparar uma simulação personalizada para você? ⚡💰',
 true, 1, ARRAY['aberta','em_andamento'], true, 5),

-- B4: Reativação 5 dias (conversa parada)
('00000000-0000-0000-0000-000000000001',
 '💬 Auto: Reativação - 5 dias',
 'Última tentativa de reativação ao CLIENTE para conversas paradas. Tom leve, sem pressão.',
 'conversa_parada', 7200, 'baixa',
 'Olá! Tudo bem? 😊 Faz alguns dias que conversamos sobre energia solar. Caso queira retomar, temos condições especiais este mês e posso fazer uma visita técnica sem compromisso. É só me chamar! ☀️🏠',
 true, 1, ARRAY['aberta','em_andamento','parada'], true, 7);
