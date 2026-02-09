
INSERT INTO wa_followup_rules (tenant_id, nome, cenario, prazo_horas, max_tentativas, mensagem_template, envio_automatico, ativo, status_conversa, ordem)
VALUES
-- EQUIPE SEM RESPOSTA: Escalonamento urgente
('00000000-0000-0000-0000-000000000001', 'Alerta urgente - Equipe sem resposta 5min', 'equipe_sem_resposta', 0.0833, 1, NULL, false, true, ARRAY['open','pending'], 7),
('00000000-0000-0000-0000-000000000001', 'Alerta crítico - Equipe sem resposta 15min', 'equipe_sem_resposta', 0.25, 2, NULL, false, true, ARRAY['open','pending'], 8),

-- EQUIPE SEM RESPOSTA: Boas-vindas / Primeiro contato (automático)
('00000000-0000-0000-0000-000000000001', 'Boas-vindas - Primeiro contato 5min', 'equipe_sem_resposta', 0.0833, 1, 'Olá! 👋 Recebemos sua mensagem e já estamos encaminhando para um atendente. Em breve retornaremos!', true, true, ARRAY['pending'], 9),

-- CLIENTE SEM RESPOSTA: Follow-ups adicionais
('00000000-0000-0000-0000-000000000001', 'Follow-up 4h - Lembrete gentil', 'cliente_sem_resposta', 4, 2, 'Oi! Vi que ainda não conseguimos falar. Posso te ajudar com alguma dúvida sobre energia solar? ☀️', true, true, ARRAY['open'], 10),
('00000000-0000-0000-0000-000000000001', 'Follow-up 48h - Reforço', 'cliente_sem_resposta', 48, 2, 'Olá! Ainda estamos à disposição para te ajudar com seu projeto de energia solar. Tem alguma dúvida que possamos esclarecer? 🔋', true, true, ARRAY['open'], 11),

-- CONVERSA PARADA: Reativação de leads frios (misto)
('00000000-0000-0000-0000-000000000001', 'Reativação - Conversa parada 15 dias', 'conversa_parada', 360, 1, 'Olá! Faz um tempo que não conversamos. Gostaria de retomar seu projeto de energia solar? Temos novidades! ☀️💡', true, true, ARRAY['open'], 12),
('00000000-0000-0000-0000-000000000001', 'Reativação final - Conversa parada 30 dias', 'conversa_parada', 720, 1, NULL, false, true, ARRAY['open'], 13),

-- CONVERSA PARADA: Pós-venda / Satisfação (conversas resolvidas)
('00000000-0000-0000-0000-000000000001', 'Pós-venda - Satisfação 24h', 'conversa_parada', 24, 1, 'Olá! Seu atendimento foi finalizado. De 1 a 5, como avalia nosso atendimento? ⭐ Sua opinião é muito importante!', true, true, ARRAY['resolved'], 14),
('00000000-0000-0000-0000-000000000001', 'Pós-venda - Fidelização 7 dias', 'conversa_parada', 168, 1, 'Olá! Esperamos que esteja satisfeito(a) com nosso atendimento. Lembre-se: estamos sempre à disposição para dúvidas sobre seu sistema solar! ☀️🔧', true, true, ARRAY['resolved'], 15);
