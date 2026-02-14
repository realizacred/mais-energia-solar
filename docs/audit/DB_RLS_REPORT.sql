-- ============================================================
-- DB_RLS_REPORT.sql — Auditoria completa de RLS/Policies/Triggers
-- Executar no SQL Editor do Supabase
-- Data: 2026-02-14
-- ============================================================

-- 1) TABELAS + RLS ON/OFF
SELECT '=== 1. RLS STATUS ===' AS section;
SELECT
  c.relname AS "table",
  c.relrowsecurity AS rls_on,
  c.relforcerowsecurity AS force_rls_on
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 1;

-- 2) POLICIES COMPLETAS
SELECT '=== 2. POLICIES ===' AS section;
SELECT
  tablename, policyname, permissive, roles, cmd,
  qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) TRIGGERS
SELECT '=== 3. TRIGGERS ===' AS section;
SELECT
  event_object_table AS "table",
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY 1, 2, 3;

-- 4) TABELAS SEM tenant_id
SELECT '=== 4. TABELAS SEM TENANT_ID ===' AS section;
SELECT c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
AND c.relname NOT IN (
  SELECT table_name FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'tenant_id'
)
ORDER BY 1;

-- 5) TABELAS COM tenant_id MAS SEM ÍNDICE
SELECT '=== 5. TABELAS SEM ÍNDICE EM TENANT_ID ===' AS section;
SELECT t.table_name
FROM information_schema.columns t
WHERE t.table_schema = 'public' AND t.column_name = 'tenant_id'
AND t.table_name NOT IN (
  SELECT tablename FROM pg_indexes
  WHERE schemaname = 'public' AND indexdef ILIKE '%tenant_id%'
)
ORDER BY 1;

-- 6) POLICIES COM USING TRUE (PÚBLICAS)
SELECT '=== 6. POLICIES PÚBLICAS (USING TRUE) ===' AS section;
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND (qual = 'true' OR with_check = 'true')
ORDER BY 1, 2;

-- 7) MVs SEM TENANT_ID
SELECT '=== 7. MATERIALIZED VIEWS SEM TENANT_ID ===' AS section;
SELECT matviewname, definition
FROM pg_matviews
WHERE schemaname IN ('public', 'extensions')
AND definition NOT ILIKE '%tenant_id%';

-- 8) FUNÇÕES PUBLIC
SELECT '=== 8. FUNÇÕES PUBLIC ===' AS section;
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS returns,
  l.lanname AS language,
  p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
ORDER BY 1;

-- 9) ÍNDICES
SELECT '=== 9. ÍNDICES ===' AS section;
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
