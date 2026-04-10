UPDATE tenant_premises
SET wa_template_reagendamento_instalacao = 'Olá {{nome_cliente}}! Sua instalação foi reagendada para {{data}} às {{hora}}. Motivo: {{motivo}}. Qualquer dúvida, fale com {{consultor}}.'
WHERE wa_template_reagendamento_instalacao IS NULL;