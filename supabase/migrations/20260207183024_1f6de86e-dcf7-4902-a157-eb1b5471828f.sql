
-- Helper: check if user has any admin-level role
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'gerente', 'financeiro')
  )
$$;

-- 1. user_roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. vendedores
CREATE POLICY "Authenticated can read vendedores"
  ON public.vendedores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage vendedores"
  ON public.vendedores FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 4. leads
CREATE POLICY "Anyone can insert leads"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can manage leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores can read their leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    vendedor IN (
      SELECT nome FROM public.vendedores WHERE user_id = auth.uid()
    )
  );

-- 5. orcamentos
CREATE POLICY "Admins can manage orcamentos"
  ON public.orcamentos FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores can read their orcamentos"
  ON public.orcamentos FOR SELECT
  TO authenticated
  USING (
    vendedor IN (
      SELECT nome FROM public.vendedores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendedores can update their orcamentos"
  ON public.orcamentos FOR UPDATE
  TO authenticated
  USING (
    vendedor IN (
      SELECT nome FROM public.vendedores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Vendedores can delete their orcamentos"
  ON public.orcamentos FOR DELETE
  TO authenticated
  USING (
    vendedor IN (
      SELECT nome FROM public.vendedores WHERE user_id = auth.uid()
    )
  );

-- 6. lead_status
CREATE POLICY "Authenticated can read lead_status"
  ON public.lead_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage lead_status"
  ON public.lead_status FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 7. clientes
CREATE POLICY "Admins can manage clientes"
  ON public.clientes FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores can read their clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE vendedor IN (
        SELECT nome FROM public.vendedores WHERE user_id = auth.uid()
      )
    )
  );

-- 8. calculadora_config
CREATE POLICY "Admins can manage calculadora_config"
  ON public.calculadora_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 9. financiamento_bancos
CREATE POLICY "Admins can manage financiamento_bancos"
  ON public.financiamento_bancos FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 10. comissoes
CREATE POLICY "Admins can manage comissoes"
  ON public.comissoes FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores can read own comissoes"
  ON public.comissoes FOR SELECT
  TO authenticated
  USING (
    vendedor_id IN (
      SELECT id FROM public.vendedores WHERE user_id = auth.uid()
    )
  );

-- 11. projetos
CREATE POLICY "Admins can manage projetos"
  ON public.projetos FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores can read their projetos"
  ON public.projetos FOR SELECT
  TO authenticated
  USING (
    vendedor_id IN (
      SELECT id FROM public.vendedores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Instaladores can read assigned projetos"
  ON public.projetos FOR SELECT
  TO authenticated
  USING (instalador_id = auth.uid());

-- 12. servicos_agendados
CREATE POLICY "Admins can manage servicos"
  ON public.servicos_agendados FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Instaladores can read own servicos"
  ON public.servicos_agendados FOR SELECT
  TO authenticated
  USING (instalador_id = auth.uid());

CREATE POLICY "Instaladores can update own servicos"
  ON public.servicos_agendados FOR UPDATE
  TO authenticated
  USING (instalador_id = auth.uid());

-- 13. Financial tables (admin only)
CREATE POLICY "Admins can manage recebimentos"
  ON public.recebimentos FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage parcelas"
  ON public.parcelas FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage pagamentos"
  ON public.pagamentos FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage pagamentos_comissao"
  ON public.pagamentos_comissao FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 14. Gamification / Vendedor performance
CREATE POLICY "Admins manage vendedor_performance"
  ON public.vendedor_performance_mensal FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores read own performance"
  ON public.vendedor_performance_mensal FOR SELECT
  TO authenticated
  USING (vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage vendedor_metas"
  ON public.vendedor_metas FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores read own metas"
  ON public.vendedor_metas FOR SELECT
  TO authenticated
  USING (vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage vendedor_metricas"
  ON public.vendedor_metricas FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores read own metricas"
  ON public.vendedor_metricas FOR SELECT
  TO authenticated
  USING (vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage vendedor_achievements"
  ON public.vendedor_achievements FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores read own achievements"
  ON public.vendedor_achievements FOR SELECT
  TO authenticated
  USING (vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage meta_notifications"
  ON public.meta_notifications FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores manage own notifications"
  ON public.meta_notifications FOR ALL
  TO authenticated
  USING (vendedor_id IN (SELECT id FROM public.vendedores WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage gamification_config"
  ON public.gamification_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read gamification_config"
  ON public.gamification_config FOR SELECT
  TO authenticated
  USING (true);

-- 15. Checklist tables
CREATE POLICY "Admins manage checklist_templates"
  ON public.checklist_templates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read active templates"
  ON public.checklist_templates FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "Admins manage template_items"
  ON public.checklist_template_items FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read template_items"
  ON public.checklist_template_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage checklists_cliente"
  ON public.checklists_cliente FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage checklists_instalador"
  ON public.checklists_instalador FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Instaladores read own checklists"
  ON public.checklists_instalador FOR SELECT
  TO authenticated
  USING (instalador_id = auth.uid());

CREATE POLICY "Instaladores update own checklists"
  ON public.checklists_instalador FOR UPDATE
  TO authenticated
  USING (instalador_id = auth.uid());

CREATE POLICY "Admins manage cl_cliente_respostas"
  ON public.checklist_cliente_respostas FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage cl_instalador_respostas"
  ON public.checklist_instalador_respostas FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Instaladores manage own respostas"
  ON public.checklist_instalador_respostas FOR ALL
  TO authenticated
  USING (respondido_por = auth.uid());

CREATE POLICY "Admins manage cl_cliente_arquivos"
  ON public.checklist_cliente_arquivos FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage cl_instalador_arquivos"
  ON public.checklist_instalador_arquivos FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Instaladores manage own arquivos"
  ON public.checklist_instalador_arquivos FOR ALL
  TO authenticated
  USING (uploaded_by = auth.uid());

-- 16. checklists_instalacao
CREATE POLICY "Admins manage checklists_instalacao"
  ON public.checklists_instalacao FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Instaladores manage own instalacao"
  ON public.checklists_instalacao FOR ALL
  TO authenticated
  USING (instalador_id = auth.uid());

-- 17. Config tables
CREATE POLICY "Admins manage concessionarias"
  ON public.concessionarias FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read concessionarias"
  ON public.concessionarias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anon read concessionarias"
  ON public.concessionarias FOR SELECT
  TO anon
  USING (ativo = true);

CREATE POLICY "Admins manage disjuntores"
  ON public.disjuntores FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read disjuntores"
  ON public.disjuntores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage transformadores"
  ON public.transformadores FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read transformadores"
  ON public.transformadores FOR SELECT
  TO authenticated
  USING (true);

-- 18. Instagram
CREATE POLICY "Admins manage instagram_config"
  ON public.instagram_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Public read instagram_posts"
  ON public.instagram_posts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage instagram_posts"
  ON public.instagram_posts FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 19. WhatsApp
CREATE POLICY "Admins manage whatsapp_config"
  ON public.whatsapp_automation_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage whatsapp_templates"
  ON public.whatsapp_automation_templates FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read whatsapp_templates"
  ON public.whatsapp_automation_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage whatsapp_logs"
  ON public.whatsapp_automation_logs FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage whatsapp_messages"
  ON public.whatsapp_messages FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage whatsapp_reminders"
  ON public.whatsapp_reminders FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores manage own reminders"
  ON public.whatsapp_reminders FOR ALL
  TO authenticated
  USING (created_by = auth.uid());

-- 20. Misc tables
CREATE POLICY "Admins manage webhook_config"
  ON public.webhook_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage financiamento_api_config"
  ON public.financiamento_api_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins read audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage lead_atividades"
  ON public.lead_atividades FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Vendedores manage own atividades"
  ON public.lead_atividades FOR ALL
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Admins manage simulacoes"
  ON public.simulacoes FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Anon can insert simulacoes"
  ON public.simulacoes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins manage layouts_solares"
  ON public.layouts_solares FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Instaladores manage own layouts"
  ON public.layouts_solares FOR ALL
  TO authenticated
  USING (created_by = auth.uid());

-- 21. Instalador config/metas/performance
CREATE POLICY "Admins manage instalador_config"
  ON public.instalador_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated read instalador_config"
  ON public.instalador_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage instalador_metas"
  ON public.instalador_metas FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Instaladores read own metas"
  ON public.instalador_metas FOR SELECT
  TO authenticated
  USING (instalador_id = auth.uid());

CREATE POLICY "Admins manage instalador_performance"
  ON public.instalador_performance_mensal FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Instaladores read own performance"
  ON public.instalador_performance_mensal FOR SELECT
  TO authenticated
  USING (instalador_id = auth.uid());
