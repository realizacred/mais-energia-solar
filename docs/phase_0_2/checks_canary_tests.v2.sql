-- ================================================================
-- CHECKS E CANARY TESTS v2 - Fase 0.2
-- Executar APÓS cada migration (003.v2 e 004.v2)
-- ================================================================
-- MUDANÇAS v1 → v2:
-- - CHECK G: Validação dos triggers de resolução anon
-- - CHECK H: Teste de INSERT anônimo (leads/orcamentos/simulacoes)
-- - CHECK I: Validação de edge functions (tenant_id em inserts)
-- - Smoke tests ampliados com fluxos anônimos
-- ================================================================


-- ============================================================
-- CHECK A: Relatório por tabela
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
  COUNT(p.policyname) FILTER (
    WHERE p.qual::text NOT LIKE '%tenant_id%'
      AND COALESCE(p.with_check::text, '') NOT LIKE '%tenant_id%'
      AND p.policyname IS NOT NULL
  ) DESC,
  t.tablename;


-- ============================================================
-- CHECK B: Tabelas sem NENHUMA policy
-- ============================================================

SELECT t.tablename AS tabela_sem_policy
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0
ORDER BY t.tablename;


-- ============================================================
-- CHECK C: Tabelas com RLS desabilitado
-- ============================================================

SELECT tablename AS tabela_rls_desabilitado
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;


-- ============================================================
-- CHECK D: Policies com USING(true)/WITH CHECK(true) em escrita
-- (excluindo service_role e SELECT)
-- ============================================================

SELECT
  tablename, policyname, cmd, roles,
  qual AS using_clause, with_check
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
-- APÓS 004: deve ter ZERO legadas (exceto preservadas)
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
-- APÓS 004: deve estar ZERADO
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


-- ============================================================
-- CHECK G (v2): Verificar triggers de resolução de tenant anônimo
-- ============================================================

SELECT
  tg.trigger_name,
  tg.event_object_table AS tabela,
  tg.action_timing AS timing,
  tg.event_manipulation AS evento,
  tg.action_statement AS funcao
FROM information_schema.triggers tg
WHERE tg.trigger_name IN (
  'resolve_lead_tenant_id_trg',
  'resolve_orc_tenant_id_trg',
  'resolve_sim_tenant_id_trg'
)
ORDER BY tg.event_object_table;

-- ESPERADO: 3 linhas (leads, orcamentos, simulacoes), timing=BEFORE, evento=INSERT


-- ============================================================
-- CHECK H (v2): Verificar que resolve_public_tenant_id() funciona
-- ============================================================

-- Deve retornar o UUID do tenant ativo (se single-tenant)
SELECT resolve_public_tenant_id() AS tenant_padrao;

-- Verificar que existem os triggers nas tabelas
SELECT
  t.tablename,
  EXISTS (
    SELECT 1 FROM information_schema.triggers tg
    WHERE tg.event_object_table = t.tablename
      AND tg.trigger_name LIKE 'resolve_%tenant%'
  ) AS tem_trigger_resolucao,
  (
    SELECT column_default FROM information_schema.columns
    WHERE table_name = t.tablename AND column_name = 'tenant_id'
      AND table_schema = 'public'
  ) AS default_tenant_id
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN ('leads', 'orcamentos', 'simulacoes')
ORDER BY t.tablename;

-- ESPERADO: tem_trigger_resolucao = true, default_tenant_id = NULL (trigger resolve)


-- ============================================================
-- CHECK I (v2): Verificar policies service_role com WITH CHECK
-- Todas as policies service_role devem ter WITH CHECK (tenant_id IS NOT NULL)
-- ============================================================

SELECT
  tablename,
  policyname,
  cmd,
  roles,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND roles::text LIKE '%service_role%'
  AND (
    with_check IS NULL
    OR with_check::text NOT LIKE '%tenant_id%'
  )
  -- Excluir audit_logs (guard_audit_insert já protege)
  AND tablename != 'audit_logs'
ORDER BY tablename, policyname;

-- ESPERADO: 0 linhas (todas as policies service_role exigem tenant_id IS NOT NULL)


-- ================================================================
-- CANARY TESTS (setup + instruções manuais)
-- ================================================================

-- SETUP: Criar tenants de teste
INSERT INTO public.tenants (id, nome, slug, ativo)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Canary Tenant A', 'canary-a', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Canary Tenant B', 'canary-b', true)
ON CONFLICT (id) DO NOTHING;

-- Criar lead_status de teste
INSERT INTO public.lead_status (id, nome, cor, ordem, tenant_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Novo (A)', '#00ff00', 1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'Novo (B)', '#0000ff', 1, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;

-- Leads de teste
INSERT INTO public.leads (id, nome, telefone, cidade, estado, area, tipo_telhado, rede_atendimento, media_consumo, consumo_previsto, tenant_id)
VALUES
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Lead Test A', '11999990001', 'São Paulo', 'SP', 'Residencial', 'Cerâmico', 'Urbana', 500, 500, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lead Test B', '21999990002', 'Rio de Janeiro', 'RJ', 'Comercial', 'Metálico', 'Rural', 1000, 1000, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;


-- ================================================================
-- TESTES MANUAIS — ISOLAMENTO CROSS-TENANT
-- ================================================================
--
-- 1. Login como user do tenant A:
--    SELECT * FROM leads → ESPERADO: apenas Lead Test A
--    SELECT * FROM leads WHERE tenant_id = 'bbbb...' → ESPERADO: 0 rows
--
-- 2. Login como user do tenant B:
--    SELECT * FROM leads → ESPERADO: apenas Lead Test B
--
-- 3. Admin de tenant A:
--    → Deve ver TUDO do tenant A, NADA do tenant B
--
-- 4. Service_role:
--    → INSERT com tenant_id → OK
--    → INSERT sem tenant_id → DEVE FALHAR (WITH CHECK violation)


-- ================================================================
-- TESTES MANUAIS — INSERTS ANÔNIMOS (v2 NEW)
-- ================================================================
--
-- 5. INSERT anônimo em leads (como se fosse formulário público):
--    Executar como anon (sem auth):
--
--    INSERT INTO leads (nome, telefone, cidade, estado, area,
--      tipo_telhado, rede_atendimento, media_consumo, consumo_previsto,
--      visto, visto_admin)
--    VALUES ('Test Anon Lead', '11999991234', 'São Paulo', 'SP',
--      'Residencial', 'Cerâmico', 'Urbana', 300, 300, false, false);
--
--    → ESPERADO: INSERT bem-sucedido
--    → Verificar: SELECT tenant_id FROM leads WHERE nome = 'Test Anon Lead'
--    → tenant_id NÃO deve ser NULL (trigger resolveu)
--
-- 6. INSERT anônimo em orcamentos:
--    (Primeiro criar lead de teste, usar seu ID)
--
--    INSERT INTO orcamentos (lead_id, tipo_telhado, area, estado, cidade,
--      rede_atendimento, media_consumo, consumo_previsto,
--      visto, visto_admin)
--    VALUES ('<lead_id_do_teste>', 'Cerâmico', 'Residencial', 'SP',
--      'São Paulo', 'Urbana', 300, 300, false, false);
--
--    → ESPERADO: INSERT bem-sucedido, tenant_id herdado do lead
--
-- 7. INSERT anônimo em simulacoes:
--
--    INSERT INTO simulacoes (consumo_kwh)
--    VALUES (500);
--
--    → ESPERADO: INSERT bem-sucedido, tenant_id resolvido via fallback
--
-- 8. INSERT anônimo com tenant_id de OUTRO tenant:
--
--    INSERT INTO leads (nome, telefone, ..., tenant_id)
--    VALUES ('Hacker', '11999998888', ..., 'bbbb...');
--
--    → ESPERADO: Sucesso (trigger mantém tenant_id explícito)
--    → NOTA: Em single-tenant isso não é um problema.
--    → Em multi-tenant futuro: adicionar validação no trigger
--      que confirma que o tenant_id passado corresponde à chave pública.


-- ================================================================
-- CLEANUP (executar após testes canary)
-- ================================================================
-- DELETE FROM leads WHERE nome IN ('Test Anon Lead', 'Lead Test A', 'Lead Test B');
-- DELETE FROM lead_status WHERE id IN ('11111111-...', '22222222-...');
-- DELETE FROM tenants WHERE id IN ('aaaaaaaa-...', 'bbbbbbbb-...');


-- ================================================================
-- SMOKE TEST CHECKLIST
-- ================================================================
--
-- Após aplicar 003.v2+004.v2, testar estes fluxos no frontend:
--
-- [ ] 1. LEADS
--     [ ] Admin pode listar todos os leads (seu tenant)
--     [ ] Vendedor vê apenas seus leads
--     [ ] Formulário público (anon) consegue criar lead ← v2 NOVO
--     [ ] Lead criado via formulário tem tenant_id correto ← v2 NOVO
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
--     [ ] Formulário público cria orçamento ← v2 NOVO
--     [ ] Orçamento criado tem tenant_id correto ← v2 NOVO
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
--     [ ] Simulação funciona (anon) ← v2 com tenant_id resolvido
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
-- [ ] 11. EDGE FUNCTIONS (v2 NOVO)
--     [ ] instagram-sync insere posts com tenant_id ← FIX NECESSÁRIO
--     [ ] send-whatsapp-message loga com tenant_id ← FIX NECESSÁRIO
--     [ ] process-whatsapp-automations loga com tenant_id ← FIX NECESSÁRIO
--     [ ] evolution-webhook cria eventos com tenant_id ← OK
--     [ ] solar-market-webhook cria eventos com tenant_id ← OK
--
-- ================================================================
