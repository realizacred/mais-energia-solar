
INSERT INTO proposta_email_templates (tenant_id, nome, assunto, corpo_html, ativo, ordem, canal, corpo_texto, variaveis, is_default)
SELECT 
  t.id,
  'Resumo Solar Padrão',
  'Proposta Solar',
  '',
  true,
  0,
  'whatsapp',
  E'🌞 Olá, {{cliente_nome}}!\n\n*Segue o resumo do dimensionamento do seu sistema de energia solar:*\n\n🏠 *Estrutura:* {{tipo_instalacao}}\n🔋 *Potência do Sistema:* {{potencia_kwp}}kWp\n🛠️ *Módulos:* {{numero_modulos}} placas\n⚡ *Inversor:* {{modelo_inversor}}\n\n📊 *Consumo e Geração*\n🌍 Consumo médio mensal: {{consumo_mensal}} kWh\n🌞 Geração estimada: {{geracao_mensal}} kWh\n\n💲 *Investimento*\n💵 Valor Total: R$ {{valor_total}}\n\n📎 *Acesse sua proposta completa:*\n👉 {{proposta_link}}',
  '[{"key":"cliente_nome","label":"Nome do cliente","origem":"lead.nome"},{"key":"tipo_instalacao","label":"Tipo de instalação","origem":"snapshot.tipo_telhado"},{"key":"potencia_kwp","label":"Potência kWp","origem":"proposta_versoes.potencia_kwp"},{"key":"numero_modulos","label":"Qtd módulos","origem":"snapshot.numero_modulos"},{"key":"modelo_inversor","label":"Modelo inversor","origem":"snapshot.modelo_inversor"},{"key":"consumo_mensal","label":"Consumo mensal kWh","origem":"snapshot.consumo_mensal"},{"key":"geracao_mensal","label":"Geração mensal kWh","origem":"proposta_versoes.geracao_mensal"},{"key":"valor_total","label":"Valor total","origem":"proposta_versoes.valor_total"},{"key":"proposta_link","label":"Link da proposta","origem":"gerado no envio"}]'::jsonb,
  true
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM proposta_email_templates pet 
  WHERE pet.tenant_id = t.id AND pet.canal = 'whatsapp' AND pet.is_default = true
);
