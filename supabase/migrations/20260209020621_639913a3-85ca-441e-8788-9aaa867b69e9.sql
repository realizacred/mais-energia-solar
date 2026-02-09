
-- Seed: Respostas Rápidas para segmento de energia solar
INSERT INTO public.wa_quick_replies (titulo, conteudo, emoji, categoria, ordem, ativo) VALUES
-- Categoria: Saudações
('Boas-vindas', 'Olá! 👋 Bem-vindo(a) à Mais Energia Solar! Somos especialistas em sistemas fotovoltaicos. Como posso te ajudar hoje?', '👋', 'Saudações', 1, true),
('Bom dia', 'Bom dia! ☀️ Aqui é da equipe Mais Energia Solar. Em que posso te ajudar?', '☀️', 'Saudações', 2, true),
('Boa tarde', 'Boa tarde! 🌤️ Aqui é da equipe Mais Energia Solar. Estou à disposição para te ajudar!', '🌤️', 'Saudações', 3, true),

-- Categoria: Informações do Sistema
('O que é energia solar?', 'A energia solar fotovoltaica transforma a luz do sol em eletricidade através de painéis solares. ☀️⚡ Com ela, você pode reduzir até *95% da sua conta de luz* e ainda contribuir com o meio ambiente! Gostaria de saber mais?', '💡', 'Informações', 4, true),
('Como funciona o sistema?', 'O sistema funciona assim:\n\n1️⃣ *Painéis solares* captam a luz do sol\n2️⃣ O *inversor* converte a energia gerada\n3️⃣ A energia é usada na sua casa/empresa\n4️⃣ O excedente vai pra rede e vira *créditos de energia*\n\nÉ simples, silencioso e praticamente sem manutenção! 🔧', '⚡', 'Informações', 5, true),
('Vida útil e garantia', 'Os painéis solares têm vida útil de *+25 anos* com garantia de performance! 🏗️\n\nGarantias típicas:\n• Painéis: 25 anos de performance\n• Inversores: 10-15 anos\n• Estrutura: 12 anos\n\nO retorno do investimento acontece em média entre *3 a 5 anos*. Depois disso, é economia pura! 💰', '🛡️', 'Informações', 6, true),

-- Categoria: Comercial
('Solicitar orçamento', 'Para fazer um orçamento personalizado, preciso de algumas informações:\n\n📋 *Nome completo*\n📍 *Cidade e estado*\n💡 *Valor médio da conta de luz* (ou consumo em kWh)\n📱 *Tipo de instalação* (residencial, comercial ou rural)\n\nPode me enviar esses dados?', '📋', 'Comercial', 7, true),
('Formas de pagamento', 'Trabalhamos com diversas formas de pagamento:\n\n💳 *Cartão de crédito* - até 12x\n🏦 *Financiamento bancário* - até 120 meses com taxas especiais\n💰 *PIX/Transferência* - com desconto especial\n📄 *Boleto* - entrada + parcelas\n\nQual forma seria melhor para você?', '💳', 'Comercial', 8, true),
('Financiamento solar', 'Temos condições especiais de *financiamento para energia solar*! 🏦\n\n✅ Taxas a partir de 0,99% a.m.\n✅ Até 120 meses para pagar\n✅ Sem entrada em muitos casos\n✅ A parcela fica menor que a conta de luz!\n\nPosso simular um financiamento para você? Basta me enviar o valor da sua conta de luz. 📊', '🏦', 'Comercial', 9, true),
('Enviar calculadora', 'Preparei nossa *calculadora de economia solar* para você! 🧮\n\nAcesse o link abaixo, preencha seus dados de consumo e veja na hora quanto você pode economizar:\n\n👉 Acesse nossa calculadora no site!\n\nQualquer dúvida, estou por aqui! 😊', '🧮', 'Comercial', 10, true),

-- Categoria: Acompanhamento
('Status do projeto', 'Vou verificar o status do seu projeto agora mesmo! 🔍\n\nPode me informar seu *nome completo* ou *número do protocolo* para eu localizar?', '🔍', 'Acompanhamento', 11, true),
('Visita técnica agendada', 'Sua visita técnica está agendada! ✅\n\nNosso técnico irá até o local para avaliar:\n📐 Área disponível para instalação\n🔌 Quadro de energia elétrica\n🏠 Orientação e inclinação do telhado\n\nFique tranquilo, não tem custo nenhum! Alguma dúvida?', '📐', 'Acompanhamento', 12, true),
('Homologação junto à concessionária', 'Sobre a *homologação junto à concessionária*:\n\n📝 Após a instalação, cuidamos de todo o processo burocrático\n⏱️ O prazo médio é de *30 a 60 dias*\n✅ Acompanhamos até a troca do medidor bidirecional\n\nVocê não precisa se preocupar com nada! Cuidamos de tudo. 😊', '📝', 'Acompanhamento', 13, true),

-- Categoria: Pós-venda
('Manutenção preventiva', 'A manutenção do sistema solar é bem simples! 🧹\n\n✅ Limpeza dos painéis a cada 6-12 meses\n✅ Verificação das conexões elétricas\n✅ Monitoramento do inversor\n\nOferecemos planos de manutenção preventiva. Quer saber mais? 🔧', '🔧', 'Pós-venda', 14, true),
('Monitoramento de geração', 'Você pode acompanhar a geração do seu sistema em *tempo real* pelo celular! 📱\n\nO app do inversor mostra:\n📊 Geração diária, mensal e total\n⚡ Potência instantânea\n🌍 Economia de CO₂\n💰 Economia em R$\n\nPrecisa de ajuda para configurar? Posso te orientar!', '📊', 'Pós-venda', 15, true),

-- Categoria: Encerramento
('Agradecimento', 'Muito obrigado pelo seu contato! 🙏\n\nFicamos felizes em poder te ajudar. Se surgir qualquer dúvida sobre energia solar, é só nos chamar!\n\n☀️ *Mais Energia Solar* - Economia e sustentabilidade para você!', '🙏', 'Encerramento', 16, true),
('Fora do horário', 'Olá! Nosso horário de atendimento é de *segunda a sexta, das 8h às 18h* e *sábados das 8h às 12h*. ⏰\n\nSua mensagem é muito importante! Retornaremos o contato assim que possível no próximo dia útil.\n\nEnquanto isso, acesse nosso site para mais informações! 😊', '⏰', 'Encerramento', 17, true);
