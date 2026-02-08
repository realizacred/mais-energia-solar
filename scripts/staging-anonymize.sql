-- =====================================================================
-- SCRIPT DE ANONIMIZAÇÃO PARA AMBIENTE DE STAGING
-- =====================================================================
-- 
-- OBJETIVO: Mascarar dados sensíveis mantendo integridade referencial
-- 
-- INSTRUÇÕES DE USO:
-- 1. Faça backup do banco de staging ANTES de rodar
-- 2. Conecte ao banco de STAGING (nunca produção!)
-- 3. Execute este script completo
-- 4. Verifique os dados com os SELECTs de validação ao final
--
-- ROLLBACK: Restaure o backup feito no passo 1
-- =====================================================================

-- ======= VERIFICAÇÃO DE SEGURANÇA =======
-- Descomente a linha abaixo para confirmar que está no banco correto
-- SELECT current_database(); -- Deve retornar o nome do banco de STAGING

BEGIN;

-- =====================================================================
-- 1. LEADS — Mascarar nome, telefone, endereço
-- =====================================================================
UPDATE leads SET
  nome = 'Lead Teste ' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 4, '0'),
  telefone = '(11) 9' || LPAD((random() * 99999999)::int::text, 8, '0'),
  telefone_normalized = '119' || LPAD((random() * 99999999)::int::text, 8, '0'),
  rua = CASE WHEN rua IS NOT NULL THEN 'Rua Exemplo ' || (random() * 999)::int::text ELSE NULL END,
  numero = CASE WHEN numero IS NOT NULL THEN (random() * 999)::int::text ELSE NULL END,
  complemento = CASE WHEN complemento IS NOT NULL THEN 'Apto ' || (random() * 99)::int::text ELSE NULL END,
  bairro = CASE WHEN bairro IS NOT NULL THEN 'Bairro Teste' ELSE NULL END,
  cep = CASE WHEN cep IS NOT NULL THEN LPAD((random() * 99999)::int::text, 5, '0') || '-' || LPAD((random() * 999)::int::text, 3, '0') ELSE NULL END,
  observacoes = CASE WHEN observacoes IS NOT NULL THEN '[STAGING] Observação anonimizada' ELSE NULL END;

-- =====================================================================
-- 2. CLIENTES — Mascarar nome, telefone, CPF, email, endereço
-- =====================================================================
UPDATE clientes SET
  nome = 'Cliente Staging ' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 4, '0'),
  telefone = '(11) 9' || LPAD((random() * 99999999)::int::text, 8, '0'),
  email = CASE WHEN email IS NOT NULL THEN 'staging.' || id::text || '@teste.com' ELSE NULL END,
  cpf_cnpj = CASE WHEN cpf_cnpj IS NOT NULL THEN LPAD((random() * 99999999999)::bigint::text, 11, '0') ELSE NULL END,
  rua = CASE WHEN rua IS NOT NULL THEN 'Rua Staging ' || (random() * 999)::int::text ELSE NULL END,
  numero = CASE WHEN numero IS NOT NULL THEN (random() * 999)::int::text ELSE NULL END,
  complemento = CASE WHEN complemento IS NOT NULL THEN 'Sala ' || (random() * 99)::int::text ELSE NULL END,
  bairro = CASE WHEN bairro IS NOT NULL THEN 'Bairro Staging' ELSE NULL END,
  cep = CASE WHEN cep IS NOT NULL THEN LPAD((random() * 99999)::int::text, 5, '0') || '-' || LPAD((random() * 999)::int::text, 3, '0') ELSE NULL END,
  observacoes = CASE WHEN observacoes IS NOT NULL THEN '[STAGING] Dados anonimizados' ELSE NULL END,
  localizacao = CASE WHEN localizacao IS NOT NULL THEN '-23.5505,' || '-46.6333' ELSE NULL END,
  -- Limpar URLs de documentos sensíveis
  identidade_url = NULL,
  identidade_urls = '{}'::text[],
  comprovante_endereco_url = NULL,
  comprovante_endereco_urls = '{}'::text[],
  comprovante_beneficiaria_urls = '{}'::text[];

-- =====================================================================
-- 3. ORCAMENTOS — Mascarar endereço
-- =====================================================================
UPDATE orcamentos SET
  rua = CASE WHEN rua IS NOT NULL THEN 'Rua Staging ' || (random() * 999)::int::text ELSE NULL END,
  numero = CASE WHEN numero IS NOT NULL THEN (random() * 999)::int::text ELSE NULL END,
  complemento = CASE WHEN complemento IS NOT NULL THEN 'Apt ' || (random() * 99)::int::text ELSE NULL END,
  bairro = CASE WHEN bairro IS NOT NULL THEN 'Bairro Staging' ELSE NULL END,
  cep = CASE WHEN cep IS NOT NULL THEN LPAD((random() * 99999)::int::text, 5, '0') || '-' || LPAD((random() * 999)::int::text, 3, '0') ELSE NULL END,
  observacoes = CASE WHEN observacoes IS NOT NULL THEN '[STAGING] Observação anonimizada' ELSE NULL END;

-- =====================================================================
-- 4. PROFILES — Mascarar nome e telefone (manter user_id intacto)
-- =====================================================================
UPDATE profiles SET
  nome = 'Usuário Staging ' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 3, '0'),
  telefone = CASE WHEN telefone IS NOT NULL THEN '(11) 9' || LPAD((random() * 99999999)::int::text, 8, '0') ELSE NULL END,
  avatar_url = NULL;

-- =====================================================================
-- 5. VENDEDORES — Mascarar dados pessoais mas manter código/slug
-- =====================================================================
-- Nota: Não alterar vendedores pois os códigos/slugs são usados em URLs
-- e a integridade dos leads depende do campo vendedor (text match)

-- =====================================================================
-- 6. CHECKLISTS_INSTALACAO — Mascarar nome e endereço
-- =====================================================================
UPDATE checklists_instalacao SET
  nome_cliente = 'Cliente Staging ' || LPAD((random() * 9999)::int::text, 4, '0'),
  endereco = 'Rua Staging ' || (random() * 999)::int::text,
  bairro = CASE WHEN bairro IS NOT NULL THEN 'Bairro Staging' ELSE NULL END,
  observacoes = CASE WHEN observacoes IS NOT NULL THEN '[STAGING] Anonimizado' ELSE NULL END,
  assinatura_cliente_url = NULL,
  assinatura_instalador_url = NULL,
  fotos_urls = '{}'::text[];

-- =====================================================================
-- 7. CHECKLISTS_INSTALADOR — Mascarar endereço
-- =====================================================================
UPDATE checklists_instalador SET
  endereco = CASE WHEN endereco IS NOT NULL THEN 'Rua Staging ' || (random() * 999)::int::text ELSE NULL END,
  bairro = CASE WHEN bairro IS NOT NULL THEN 'Bairro Staging' ELSE NULL END,
  assinatura_cliente_url = NULL,
  assinatura_instalador_url = NULL,
  observacoes = CASE WHEN observacoes IS NOT NULL THEN '[STAGING] Anonimizado' ELSE NULL END,
  pendencias = CASE WHEN pendencias IS NOT NULL THEN '[STAGING] Pendência de teste' ELSE NULL END;

-- =====================================================================
-- 8. WHATSAPP_MESSAGES — Mascarar telefone e mensagem
-- =====================================================================
UPDATE whatsapp_messages SET
  telefone = '5511' || LPAD((random() * 999999999)::int::text, 9, '0'),
  mensagem = '[STAGING] Mensagem anonimizada — conteúdo original removido';

-- =====================================================================
-- 9. WHATSAPP_AUTOMATION_LOGS — Mascarar telefone e mensagem
-- =====================================================================
UPDATE whatsapp_automation_logs SET
  telefone = '5511' || LPAD((random() * 999999999)::int::text, 9, '0'),
  mensagem_enviada = '[STAGING] Mensagem anonimizada';

-- =====================================================================
-- 10. DESATIVAR AUTOMAÇÕES EM STAGING
-- =====================================================================
UPDATE whatsapp_automation_config SET
  ativo = false,
  automacoes_ativas = false
WHERE true;

-- =====================================================================
-- 11. AUDIT_LOGS — Limpar dados sensíveis do log
-- =====================================================================
-- Nota: audit_logs é imutável (triggers bloqueiam update/delete)
-- Em staging, a tabela estará vazia se criada do zero via migrations

-- =====================================================================
-- VALIDAÇÃO PÓS-ANONIMIZAÇÃO
-- =====================================================================

COMMIT;

-- Execute estas queries para validar:

-- Verificar leads anonimizados
-- SELECT nome, telefone, rua, bairro FROM leads LIMIT 5;

-- Verificar clientes anonimizados
-- SELECT nome, telefone, email, cpf_cnpj, rua FROM clientes LIMIT 5;

-- Verificar automações desativadas
-- SELECT ativo, automacoes_ativas FROM whatsapp_automation_config;

-- Contagem de registros (deve bater com produção)
-- SELECT 
--   (SELECT count(*) FROM leads) AS leads,
--   (SELECT count(*) FROM clientes) AS clientes,
--   (SELECT count(*) FROM orcamentos) AS orcamentos,
--   (SELECT count(*) FROM parcelas) AS parcelas;
