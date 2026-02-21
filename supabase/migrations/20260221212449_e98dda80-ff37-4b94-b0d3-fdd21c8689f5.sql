-- Seed default email templates for proposals
INSERT INTO public.proposta_email_templates (tenant_id, nome, assunto, corpo_html, ativo, ordem)
SELECT t.id, 'Proposta Comercial', 'Sua Proposta de Energia Solar - {{cliente_nome}}',
  '<h2>Olá {{cliente_nome}},</h2><p>Segue a sua proposta comercial de energia solar.</p><p>Clique no link abaixo para visualizar todos os detalhes:</p><p><a href="{{link_proposta}}">Acessar Proposta</a></p><p>Sistema de <strong>{{potencia_kwp}} kWp</strong> com economia estimada de <strong>{{economia_mensal}}</strong>/mês.</p><br><p>Atenciosamente,<br>{{empresa_nome}}</p>',
  true, 1
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM proposta_email_templates pet WHERE pet.tenant_id = t.id);

INSERT INTO public.proposta_email_templates (tenant_id, nome, assunto, corpo_html, ativo, ordem)
SELECT t.id, 'Proposta Resumida', 'Energia Solar - Proposta {{proposta_codigo}}',
  '<h2>{{cliente_nome}},</h2><p>Preparamos uma proposta especial para você!</p><p><strong>Investimento:</strong> {{valor_total}}<br><strong>Retorno em:</strong> {{payback_meses}} meses<br><strong>Economia mensal:</strong> {{economia_mensal}}</p><p><a href="{{link_proposta}}">Ver proposta completa</a></p><p>Equipe {{empresa_nome}}</p>',
  true, 2
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM proposta_email_templates pet WHERE pet.tenant_id = t.id AND pet.nome = 'Proposta Resumida');