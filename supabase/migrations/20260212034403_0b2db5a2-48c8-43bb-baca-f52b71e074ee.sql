
-- Templates: Objeções
INSERT INTO wa_quick_replies (titulo, conteudo, categoria, ordem, tenant_id) VALUES
  ('Preço alto', 'Entendo sua preocupação com o investimento, {nome}! Mas considere que a energia solar se paga em média em 3-4 anos, e o sistema dura mais de 25 anos. É como trocar uma conta de luz eterna por um investimento que retorna. Posso te mostrar a simulação de economia?', 'Objeções', 100, '00000000-0000-0000-0000-000000000001'),
  ('Retorno do investimento', '{nome}, com o seu consumo atual, a economia estimada é significativa. O sistema se paga em poucos anos e você terá energia praticamente gratuita pelos próximos 20+ anos. Quer ver os números detalhados?', 'Objeções', 101, '00000000-0000-0000-0000-000000000001'),
  ('Já tenho proposta', 'Que bom que está pesquisando, {nome}! Compare não só o preço, mas também: marca dos equipamentos, garantia, suporte pós-venda e experiência da empresa. Posso te enviar nossa proposta para comparação?', 'Objeções', 102, '00000000-0000-0000-0000-000000000001');

-- Templates: Urgência / Promoção
INSERT INTO wa_quick_replies (titulo, conteudo, categoria, ordem, tenant_id) VALUES
  ('Condição especial', '🔥 {nome}, temos uma condição especial válida até o final desta semana! Desconto exclusivo + condições facilitadas de pagamento. Posso reservar essa condição para você?', 'Urgência', 110, '00000000-0000-0000-0000-000000000001'),
  ('Tarifa vai subir', '⚡ {nome}, a bandeira tarifária está em alta e a tendência é de novos reajustes. Quem instala agora garante economia imediata. Vamos agendar uma visita técnica?', 'Urgência', 111, '00000000-0000-0000-0000-000000000001'),
  ('Últimas vagas do mês', '{nome}, nossa agenda de instalação para este mês está quase fechada. Se quiser garantir a instalação ainda neste período, precisamos avançar logo. Posso agendar?', 'Urgência', 112, '00000000-0000-0000-0000-000000000001');

-- Templates: Documentação
INSERT INTO wa_quick_replies (titulo, conteudo, categoria, ordem, tenant_id) VALUES
  ('Solicitar conta de luz', '{nome}, para elaborar o projeto ideal, preciso da sua última conta de luz (frente e verso). Pode me enviar uma foto por aqui mesmo? 📄', 'Documentação', 120, '00000000-0000-0000-0000-000000000001'),
  ('Documentos para contrato', E'{nome}, para seguirmos com o contrato, vou precisar dos seguintes documentos:\n\n📋 RG ou CNH\n📋 CPF\n📋 Comprovante de endereço\n📋 Última conta de luz\n\nPode enviar por aqui mesmo!', 'Documentação', 121, '00000000-0000-0000-0000-000000000001'),
  ('Documentos para financiamento', E'{nome}, para o financiamento precisaremos de:\n\n📋 RG e CPF\n📋 Comprovante de renda (últimos 3 meses)\n📋 Comprovante de endereço\n📋 Última conta de luz\n\nAssim que receber, já encaminho para análise!', 'Documentação', 122, '00000000-0000-0000-0000-000000000001');

-- Templates: Instalação
INSERT INTO wa_quick_replies (titulo, conteudo, categoria, ordem, tenant_id) VALUES
  ('Agendamento visita técnica', '{nome}, vamos agendar a visita técnica! Qual o melhor dia e horário para você? A visita dura cerca de 30 minutos. 🏠', 'Instalação', 130, '00000000-0000-0000-0000-000000000001'),
  ('Confirmação de instalação', E'{nome}, sua instalação está confirmada! 🎉\n\nAlgumas orientações:\n✅ Alguém maior de idade deve estar presente\n✅ Acesso ao telhado/local da instalação liberado\n✅ Disjuntor geral acessível\n\nQualquer dúvida, estou à disposição!', 'Instalação', 131, '00000000-0000-0000-0000-000000000001'),
  ('Pós-instalação', E'{nome}, sua instalação foi concluída com sucesso! ☀️🎉\n\nO sistema já está gerando energia. Em alguns dias a concessionária fará a troca do medidor.\n\nQualquer dúvida sobre o funcionamento, pode me chamar!', 'Instalação', 132, '00000000-0000-0000-0000-000000000001');

-- Templates: Reativação
INSERT INTO wa_quick_replies (titulo, conteudo, categoria, ordem, tenant_id) VALUES
  ('Reativação leve', 'Oi {nome}, tudo bem? 😊 Faz um tempo que conversamos sobre energia solar. Ainda tem interesse? Temos novidades e condições que podem te interessar!', 'Reativação', 140, '00000000-0000-0000-0000-000000000001'),
  ('Reativação com novidade', '{nome}, lembrei de você! Temos novas condições de financiamento com taxas reduzidas e novos equipamentos com mais eficiência. Quer que eu atualize seu orçamento?', 'Reativação', 141, '00000000-0000-0000-0000-000000000001'),
  ('Reativação última chance', '{nome}, estou fazendo uma revisão dos orçamentos pendentes. O seu ainda está válido, mas os preços dos equipamentos podem sofrer reajuste em breve. Quer aproveitar as condições atuais?', 'Reativação', 142, '00000000-0000-0000-0000-000000000001');
