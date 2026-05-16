-- Standardizing RLS for the entire Credit domain

-- 1. credit_simulations
DROP POLICY IF EXISTS "Users can view their tenant simulations" ON public.credit_simulations;
DROP POLICY IF EXISTS "Users can insert simulations in their tenant" ON public.credit_simulations;
DROP POLICY IF EXISTS "Users can update their tenant simulations" ON public.credit_simulations;

CREATE POLICY "Standard Select Simulations" ON public.credit_simulations FOR SELECT USING (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Insert Simulations" ON public.credit_simulations FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Update Simulations" ON public.credit_simulations FOR UPDATE USING (tenant_id = get_current_tenant_id());

-- 2. credit_analysis_events
DROP POLICY IF EXISTS "Users can view their tenant credit events" ON public.credit_analysis_events;
DROP POLICY IF EXISTS "System can insert credit events" ON public.credit_analysis_events;

CREATE POLICY "Standard Select Events" ON public.credit_analysis_events FOR SELECT USING (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Insert Events" ON public.credit_analysis_events FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 3. analise_credito_historico
DROP POLICY IF EXISTS "Users can view credit history from their tenant" ON public.analise_credito_historico;
DROP POLICY IF EXISTS "Users can insert credit history into their tenant" ON public.analise_credito_historico;
DROP POLICY IF EXISTS "Users can view history from their tenant" ON public.analise_credito_historico;
DROP POLICY IF EXISTS "Users can view history of their tenant" ON public.analise_credito_historico;
DROP POLICY IF EXISTS "Users can insert history for their tenant" ON public.analise_credito_historico;
DROP POLICY IF EXISTS "Users can insert history into their tenant" ON public.analise_credito_historico;

CREATE POLICY "Standard Select History" ON public.analise_credito_historico FOR SELECT USING (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Insert History" ON public.analise_credito_historico FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- 4. analise_credito_documentos
DROP POLICY IF EXISTS "Users can manage credit docs of their tenant" ON public.analise_credito_documentos;
DROP POLICY IF EXISTS "Users can view credit docs of their tenant" ON public.analise_credito_documentos;
DROP POLICY IF EXISTS "Users can delete documents from their tenant" ON public.analise_credito_documentos;
DROP POLICY IF EXISTS "Users can insert documents into their tenant" ON public.analise_credito_documentos;
DROP POLICY IF EXISTS "Users can update documents from their tenant" ON public.analise_credito_documentos;
DROP POLICY IF EXISTS "Users can view documents from their tenant" ON public.analise_credito_documentos;

CREATE POLICY "Standard Select Docs" ON public.analise_credito_documentos FOR SELECT USING (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Insert Docs" ON public.analise_credito_documentos FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Update Docs" ON public.analise_credito_documentos FOR UPDATE USING (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Delete Docs" ON public.analise_credito_documentos FOR DELETE USING (tenant_id = get_current_tenant_id());

-- 5. credit_bank_configs
DROP POLICY IF EXISTS "Users can view bank configs from their tenant" ON public.credit_bank_configs;
DROP POLICY IF EXISTS "Users can insert bank configs into their tenant" ON public.credit_bank_configs;
DROP POLICY IF EXISTS "Users can update bank configs from their tenant" ON public.credit_bank_configs;

CREATE POLICY "Standard Select Bank Configs" ON public.credit_bank_configs FOR SELECT USING (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Insert Bank Configs" ON public.credit_bank_configs FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Update Bank Configs" ON public.credit_bank_configs FOR UPDATE USING (tenant_id = get_current_tenant_id());

-- 6. credit_bank_checklists
DROP POLICY IF EXISTS "Users can view checklists from their tenant" ON public.credit_bank_checklists;
DROP POLICY IF EXISTS "Users can insert checklists into their tenant" ON public.credit_bank_checklists;
DROP POLICY IF EXISTS "Users can update checklists from their tenant" ON public.credit_bank_checklists;

CREATE POLICY "Standard Select Checklists" ON public.credit_bank_checklists FOR SELECT USING (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Insert Checklists" ON public.credit_bank_checklists FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY "Standard Update Checklists" ON public.credit_bank_checklists FOR UPDATE USING (tenant_id = get_current_tenant_id());
