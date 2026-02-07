
-- =============================================
-- STORAGE BUCKETS + POLICIES
-- =============================================

-- 1. Bucket para assets de checklists (fotos, assinaturas, áudios, vídeos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-assets', 
  'checklist-assets', 
  false,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4', 'video/mp4', 'video/webm', 'application/pdf']
);

-- 2. Bucket para documentos de clientes (identidade, comprovantes, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-clientes', 
  'documentos-clientes', 
  false,
  20971520, -- 20MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- 3. Bucket para contas de luz
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contas-luz', 
  'contas-luz', 
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- 4. Bucket para arquivos de leads (uploads públicos do formulário)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-arquivos', 
  'lead-arquivos', 
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- 5. Bucket para comprovantes de pagamento
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes', 
  'comprovantes', 
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- =============================================
-- STORAGE RLS POLICIES
-- =============================================

-- === checklist-assets ===
-- Admins podem tudo
CREATE POLICY "Admins manage checklist-assets"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'checklist-assets' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'checklist-assets' AND public.is_admin(auth.uid()));

-- Instaladores podem upload e ver seus próprios arquivos (pasta por user_id)
CREATE POLICY "Instaladores upload checklist-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'checklist-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_role(auth.uid(), 'instalador')
);

CREATE POLICY "Instaladores read own checklist-assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'checklist-assets' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.has_role(auth.uid(), 'instalador')
);

-- === documentos-clientes ===
-- Admins podem tudo
CREATE POLICY "Admins manage documentos-clientes"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'documentos-clientes' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'documentos-clientes' AND public.is_admin(auth.uid()));

-- Vendedores podem upload e visualizar
CREATE POLICY "Vendedores upload documentos-clientes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos-clientes' 
  AND public.has_role(auth.uid(), 'vendedor')
);

CREATE POLICY "Vendedores read documentos-clientes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos-clientes' 
  AND public.has_role(auth.uid(), 'vendedor')
);

-- === contas-luz ===
-- Admins podem tudo
CREATE POLICY "Admins manage contas-luz"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'contas-luz' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'contas-luz' AND public.is_admin(auth.uid()));

-- Vendedores podem upload e visualizar
CREATE POLICY "Vendedores upload contas-luz"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contas-luz' 
  AND public.has_role(auth.uid(), 'vendedor')
);

CREATE POLICY "Vendedores read contas-luz"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contas-luz' 
  AND public.has_role(auth.uid(), 'vendedor')
);

-- Anon pode upload de conta de luz (formulário público de lead)
CREATE POLICY "Anon upload contas-luz"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'contas-luz');

-- === lead-arquivos ===
-- Admins podem tudo
CREATE POLICY "Admins manage lead-arquivos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'lead-arquivos' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'lead-arquivos' AND public.is_admin(auth.uid()));

-- Anon pode upload (formulário público)
CREATE POLICY "Anon upload lead-arquivos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'lead-arquivos');

-- Vendedores podem visualizar
CREATE POLICY "Vendedores read lead-arquivos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'lead-arquivos' 
  AND (public.has_role(auth.uid(), 'vendedor') OR public.is_admin(auth.uid()))
);

-- === comprovantes ===
-- Admins podem tudo
CREATE POLICY "Admins manage comprovantes"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'comprovantes' AND public.is_admin(auth.uid()))
WITH CHECK (bucket_id = 'comprovantes' AND public.is_admin(auth.uid()));

-- Financeiro pode upload de comprovantes
CREATE POLICY "Financeiro upload comprovantes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'comprovantes' 
  AND public.has_role(auth.uid(), 'financeiro')
);

CREATE POLICY "Financeiro read comprovantes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprovantes' 
  AND public.has_role(auth.uid(), 'financeiro')
);

-- =============================================
-- ÍNDICES DE PERFORMANCE
-- =============================================

-- Índices para queries frequentes em leads
CREATE INDEX IF NOT EXISTS idx_leads_vendedor ON public.leads(vendedor);
CREATE INDEX IF NOT EXISTS idx_leads_status_id ON public.leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_telefone_normalized ON public.leads(telefone_normalized);

-- Índices para orçamentos
CREATE INDEX IF NOT EXISTS idx_orcamentos_lead_id ON public.orcamentos(lead_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_vendedor ON public.orcamentos(vendedor);
CREATE INDEX IF NOT EXISTS idx_orcamentos_status_id ON public.orcamentos(status_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_created_at ON public.orcamentos(created_at DESC);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clientes_lead_id ON public.clientes(lead_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(nome);

-- Índices para projetos
CREATE INDEX IF NOT EXISTS idx_projetos_cliente_id ON public.projetos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_projetos_vendedor_id ON public.projetos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_projetos_instalador_id ON public.projetos(instalador_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON public.projetos(status);

-- Índices para serviços agendados
CREATE INDEX IF NOT EXISTS idx_servicos_instalador_id ON public.servicos_agendados(instalador_id);
CREATE INDEX IF NOT EXISTS idx_servicos_data_agendada ON public.servicos_agendados(data_agendada);
CREATE INDEX IF NOT EXISTS idx_servicos_status ON public.servicos_agendados(status);
CREATE INDEX IF NOT EXISTS idx_servicos_projeto_id ON public.servicos_agendados(projeto_id);

-- Índices para recebimentos/parcelas
CREATE INDEX IF NOT EXISTS idx_recebimentos_cliente_id ON public.recebimentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_recebimento_id ON public.parcelas(recebimento_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_data_vencimento ON public.parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_parcelas_status ON public.parcelas(status);

-- Índices para comissões
CREATE INDEX IF NOT EXISTS idx_comissoes_vendedor_id ON public.comissoes(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_mes_ano ON public.comissoes(mes_referencia, ano_referencia);

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabela ON public.audit_logs(tabela);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Índices para vendedores
CREATE INDEX IF NOT EXISTS idx_vendedores_user_id ON public.vendedores(user_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_codigo ON public.vendedores(codigo);

-- Índices para checklists
CREATE INDEX IF NOT EXISTS idx_checklists_instalador_projeto ON public.checklists_instalador(projeto_id);
CREATE INDEX IF NOT EXISTS idx_checklists_instalador_user ON public.checklists_instalador(instalador_id);

-- Índices para lead_atividades
CREATE INDEX IF NOT EXISTS idx_lead_atividades_lead_id ON public.lead_atividades(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_atividades_data ON public.lead_atividades(data_agendada);
