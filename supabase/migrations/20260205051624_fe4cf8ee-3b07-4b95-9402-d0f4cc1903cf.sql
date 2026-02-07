-- ============================================================
-- SECURITY FIX #8: Corrigir políticas permissivas restantes
-- ============================================================

-- calculadora_config: corrigir UPDATE permissivo
DROP POLICY IF EXISTS "Authenticated users can update calculator config" ON public.calculadora_config;

CREATE POLICY "Admin/Gerente podem atualizar config calculadora"
ON public.calculadora_config
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- vendedores: corrigir UPDATE/DELETE permissivos
DROP POLICY IF EXISTS "Authenticated users can update vendedores" ON public.vendedores;
DROP POLICY IF EXISTS "Authenticated users can delete vendedores" ON public.vendedores;
DROP POLICY IF EXISTS "Authenticated users can create vendedores" ON public.vendedores;

CREATE POLICY "Admin/Gerente podem criar vendedores"
ON public.vendedores
FOR INSERT
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Admin/Gerente podem atualizar vendedores"
ON public.vendedores
FOR UPDATE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Vendedor pode atualizar próprio registro"
ON public.vendedores
FOR UPDATE
USING (has_role(auth.uid(), 'vendedor'::app_role) AND user_id = auth.uid());

CREATE POLICY "Admin/Gerente podem deletar vendedores"
ON public.vendedores
FOR DELETE
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- ============================================================
-- NOTA: As seguintes políticas de INSERT com true são INTENCIONAIS
-- e necessárias para funcionamento do sistema:
-- 
-- 1. "Public can submit leads via form" - Formulário público de leads
-- 2. "Public can submit orcamentos via form" - Formulário público de orçamentos
-- 3. "Anyone can submit checklists via public link" - Link público de checklist
-- 4. "Qualquer um pode criar simulação" - Simulador público de financiamento
-- 5. "System can insert notifications" - Sistema interno de notificações
-- 6. "System can insert achievements" - Sistema interno de gamificação
-- 7. "Inserção de logs via função segura" - Audit logs (imutáveis após inserção)
--
-- Essas políticas são mitigadas por:
-- - Logs de auditoria são imutáveis (UPDATE/DELETE bloqueados)
-- - Notificações/Achievements são internas ao sistema
-- - Formulários públicos são requisito de negócio
-- ============================================================