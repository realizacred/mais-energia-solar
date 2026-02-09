-- ================================================================
-- CHECKS E CANARY TESTS - Fase 0.2
-- Executar APÓS cada migration (003 e 004)
-- ================================================================

-- ============================================================
-- CHECK A: Relatório por tabela
-- RLS habilitado? Quantas policies? Quais comandos? Tem tenant?
-- ============================================================

SELECT
  t.tablename AS tabela,
  t.rowsecurity AS rls_ativo,
  COUNT(p.policyname) AS total_policies,
  array_agg(DISTINCT p.cmd ORDER BY p.cmd) FILTER (WHERE p.cmd IS NOT NULL) AS comandos_cobertos,
  COUNT(p.policyname) FILTER (
    WHERE p.qual::text LIKE '%tenant_id%'
       OR COALESCE(p.with_check::text, '') LIKE '%tenant_id%'
  ) AS policies_com_tenant,
  COUNT(p.policyname) FILTER (
    WHERE p.qual::text NOT LIKE '%tenant_id%'
      AND COALESCE(p.with_check::text, '') NOT LIKE '%tenant_id%'
      AND p.policyname IS NOT NULL
  ) AS policies_sem_tenant,
  array_agg(p.policyname ORDER BY p.policyname) FILTER (
    WHERE p.policyname IS NOT NULL
      AND p.qual::text NOT LIKE '%tenant_id%'
      AND COALESCE(p.with_check::text, '') NOT LIKE '%tenant_id%'
  ) AS nomes_policies_sem_tenant
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY
  -- Tabelas com policies sem tenant primeiro (problemas)
  COUNT(p.policyname) FILTER (
    WHERE p.qual::text NOT LIKE '%tenant_id%'
      AND COALESCE(p.with_check::text, '') NOT LIKE '%tenant_id%'
      AND p.policyname IS NOT NULL
  ) DESC,
  t.tablename;


-- ============================================================
-- CHECK B: Detectar tabelas sem NENHUMA policy
-- ============================================================

SELECT t.tablename AS tabela_sem_policy
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0
ORDER BY t.tablename;


-- ============================================================
-- CHECK C: Detectar tabelas com RLS desabilitado
-- ============================================================

SELECT tablename AS tabela_rls_desabilitado
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;


-- ============================================================
-- CHECK D: Detectar policies com USING(true) ou WITH CHECK(true)
-- em operações de escrita (INSERT/UPDATE/DELETE/ALL)
-- Excluindo service_role (aceito com documentação)
-- ============================================================

SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  AND (
    qual::text = 'true'
    OR with_check::text = 'true'
  )
  AND roles::text NOT LIKE '%service_role%'
ORDER BY tablename, policyname;


-- ============================================================
-- CHECK E: Contar policies por prefixo (rls_ = novas, outros = legadas)
-- ============================================================

SELECT
  CASE
    WHEN policyname LIKE 'rls_%' THEN 'NOVA (tenant-aware)'
    ELSE 'LEGADA (potencial risco)'
  END AS tipo,
  COUNT(*) AS total
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY 1
ORDER BY 1;


-- ============================================================
-- CHECK F: Tabelas com tenant_id mas SEM policy que filtre por tenant
-- (AFTER migration 004 - todas devem estar zeradas)
-- ============================================================

SELECT
  c.table_name AS tabela_vulneravel,
  COUNT(p.policyname) AS total_policies,
  COUNT(p.policyname) FILTER (
    WHERE p.qual::text LIKE '%tenant_id%'
       OR COALESCE(p.with_check::text, '') LIKE '%tenant_id%'
  ) AS com_tenant_filter
FROM information_schema.columns c
LEFT JOIN pg_policies p ON c.table_name = p.tablename AND p.schemaname = 'public'
WHERE c.table_schema = 'public'
  AND c.column_name = 'tenant_id'
GROUP BY c.table_name
HAVING COUNT(p.policyname) FILTER (
    WHERE p.qual::text LIKE '%tenant_id%'
       OR COALESCE(p.with_check::text, '') LIKE '%tenant_id%'
  ) = 0
ORDER BY c.table_name;


-- ================================================================
-- CANARY TESTS
-- ================================================================
-- 
-- INSTRUÇÃO: Executar estes testes em ambiente de STAGING.
-- Requer 2 tenants e 2 usuários configurados.
--
-- SETUP (executar como service_role / superuser):
-- 1. Criar 2 tenants: tenant_canary_a, tenant_canary_b
-- 2. Criar 2 users no auth: user_canary_a, user_canary_b
-- 3. Criar profiles com tenant_id correto
-- 4. Criar roles (admin para user_a, vendedor para user_b)
-- 5. Inserir dados de teste em leads, clientes, etc.
-- 6. Autenticar como cada user e rodar queries
--
-- NOTA: Estes testes precisam ser executados MANUALMENTE porque
-- dependem de contexto de auth (JWT). Não podem rodar em SQL puro.
--
-- ================================================================

-- SETUP: Criar tenants de teste
-- (Executar como superuser/service_role)

-- 1. Criar tenants
INSERT INTO public.tenants (id, nome, slug, ativo)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Canary Tenant A', 'canary-a', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Canary Tenant B', 'canary-b', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar dados de teste em leads (via service_role)
INSERT INTO public.lead_status (id, nome, cor, ordem, tenant_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Novo (A)', '#00ff00', 1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'Novo (B)', '#0000ff', 1, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;

-- 3. Inserir leads de teste
INSERT INTO public.leads (id, nome, telefone, cidade, estado, area, tipo_telhado, rede_atendimento, media_consumo, consumo_previsto, tenant_id)
VALUES
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Lead Test A', '11999990001', 'São Paulo', 'SP', 'Residencial', 'Cerâmico', 'Urbana', 500, 500, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lead Test B', '21999990002', 'Rio de Janeiro', 'RJ', 'Comercial', 'Metálico', 'Rural', 1000, 1000, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- TESTES MANUAIS (executar autenticado como cada user):
-- ================================================================
--
-- COMO EXECUTAR:
-- 1. Fazer login como user_canary_a (tenant A)
-- 2. No Supabase client, executar:
--    const { data } = await supabase.from('leads').select('*')
--    → ESPERADO: apenas leads do tenant A
--    const { data: b } = await supabase.from('leads').select('*').eq('tenant_id', 'bbbb...')
--    → ESPERADO: 0 rows (filtro tenant no RLS bloqueia)
--
-- 3. Fazer login como user_canary_b (tenant B)
-- 4. Repetir os mesmos testes invertidos
--
-- 5. Como admin de tenant A:
--    → Deve ver TUDO do tenant A
--    → Deve ver NADA do tenant B
--
-- 6. Como service_role:
--    → Pode inserir com tenant_id explícito
--    → INSERT sem tenant_id deve falhar (WITH CHECK tenant_id IS NOT NULL)
--
-- ================================================================

-- CLEANUP (executar após testes):
-- DELETE FROM public.leads WHERE id IN ('aaaa1111-...', 'bbbb1111-...');
-- DELETE FROM public.lead_status WHERE id IN ('11111111-...', '22222222-...');
-- DELETE FROM public.tenants WHERE id IN ('aaaaaaaa-...', 'bbbbbbbb-...');


-- ================================================================
-- SMOKE TEST CHECKLIST
-- ================================================================
--
-- Após aplicar migrations 003+004, testar estes fluxos no frontend:
--
-- [ ] 1. LEADS
--     [ ] Admin pode listar todos os leads (seu tenant)
--     [ ] Vendedor vê apenas seus leads
--     [ ] Formulário público (anon) consegue criar lead
--     [ ] Admin pode editar/deletar lead
--
-- [ ] 2. CLIENTES
--     [ ] Admin pode listar clientes
--     [ ] Vendedor vê clientes de seus leads
--     [ ] Admin pode criar/editar cliente
--
-- [ ] 3. ORÇAMENTOS
--     [ ] Admin pode listar todos
--     [ ] Vendedor vê/edita/deleta seus orçamentos
--     [ ] Formulário público cria orçamento
--
-- [ ] 4. WHATSAPP (wa_*)
--     [ ] Admin vê todas as conversas do tenant
--     [ ] Vendedor vê conversas assigned a ele
--     [ ] Mensagens de vendor são inseridas corretamente
--     [ ] Webhook (edge function) cria mensagem com tenant_id
--
-- [ ] 5. FINANCEIRO
--     [ ] Admin pode listar recebimentos
--     [ ] Admin pode listar parcelas
--     [ ] Admin pode gerenciar comissões
--
-- [ ] 6. SITE
--     [ ] Site settings carrega para visitante anônimo
--     [ ] Banners carregam (público)
--     [ ] Admin pode editar site settings
--
-- [ ] 7. CALCULADORA
--     [ ] Simulação funciona (anon)
--     [ ] Configurações da calculadora acessíveis via security definer
--
-- [ ] 8. EQUIPAMENTOS
--     [ ] Admin gerencia inversores/módulos/baterias
--     [ ] Usuários autenticados podem ler
--
-- [ ] 9. INSTALADOR
--     [ ] Instalador vê seus checklists
--     [ ] Instalador pode atualizar checklist
--     [ ] Admin vê todos os checklists do tenant
--
-- [ ] 10. VENDEDOR
--     [ ] Dashboard pessoal carrega métricas
--     [ ] Gamificação (achievements, metas) acessível
--     [ ] Follow-up e atividades funcionam
--
-- ================================================================
