-- 1. Adicionar bank_config_id em analise_credito
ALTER TABLE public.analise_credito 
    ADD COLUMN IF NOT EXISTS bank_config_id UUID REFERENCES public.credit_bank_configs(id) ON DELETE SET NULL;

-- 2. Padronizar analise_credito_historico e adicionar FKs
DO $$ 
BEGIN
    -- Se a coluna status_novo não existir, renomear novo_status
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analise_credito_historico' AND column_name = 'novo_status') THEN
        ALTER TABLE public.analise_credito_historico RENAME COLUMN novo_status TO status_novo;
    END IF;

    -- Se a coluna analise_credito_id não existir, renomear analise_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analise_credito_historico' AND column_name = 'analise_id') THEN
        ALTER TABLE public.analise_credito_historico RENAME COLUMN analise_id TO analise_credito_id;
    END IF;

    -- Se a coluna actor_id não existir, renomear usuario_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analise_credito_historico' AND column_name = 'usuario_id') THEN
        ALTER TABLE public.analise_credito_historico RENAME COLUMN usuario_id TO actor_id;
    END IF;

    -- Se a coluna observacoes não existir, renomear motivo
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analise_credito_historico' AND column_name = 'motivo') THEN
        ALTER TABLE public.analise_credito_historico RENAME COLUMN motivo TO observacoes;
    END IF;
END $$;

-- 3. Adicionar restrições e colunas em analise_credito_documentos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analise_credito_documentos' AND column_name = 'checklist_item_id') THEN
        ALTER TABLE public.analise_credito_documentos ADD COLUMN checklist_item_id UUID REFERENCES public.credit_bank_checklists(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'analise_credito_documentos' AND column_name = 'analise_id') THEN
        ALTER TABLE public.analise_credito_documentos RENAME COLUMN analise_id TO analise_credito_id;
    END IF;
    
    -- file_id deve ser UUID e apontar para project_documents(id) conforme hook useAnaliseCreditoDocumentos
    -- Se a FK analise_credito_documentos_file_id_fkey aponta para entity_files, precisamos ajustar ou manter compatibilidade
END $$;

-- 4. Adicionar constraints FK
ALTER TABLE public.analise_credito_historico 
    DROP CONSTRAINT IF EXISTS analise_credito_historico_analise_credito_id_fkey,
    ADD CONSTRAINT analise_credito_historico_analise_credito_id_fkey 
    FOREIGN KEY (analise_credito_id) REFERENCES public.analise_credito(id) ON DELETE CASCADE;

ALTER TABLE public.analise_credito_historico 
    DROP CONSTRAINT IF EXISTS analise_credito_historico_actor_id_fkey,
    ADD CONSTRAINT analise_credito_historico_actor_id_fkey 
    FOREIGN KEY (actor_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

ALTER TABLE public.analise_credito_historico 
    DROP CONSTRAINT IF EXISTS analise_credito_historico_tenant_id_fkey,
    ADD CONSTRAINT analise_credito_historico_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_analise_credito_bank_config_id ON public.analise_credito(bank_config_id);
CREATE INDEX IF NOT EXISTS idx_analise_credito_status ON public.analise_credito(status);
CREATE INDEX IF NOT EXISTS idx_analise_credito_historico_analise_id ON public.analise_credito_historico(analise_credito_id);
CREATE INDEX IF NOT EXISTS idx_analise_credito_docs_analise_id ON public.analise_credito_documentos(analise_credito_id);

-- 6. Trigger de Auditoria Automática
CREATE OR REPLACE FUNCTION public.fn_audit_analise_credito_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR (TG_OP = 'INSERT') THEN
        INSERT INTO public.analise_credito_historico (
            tenant_id,
            analise_credito_id,
            status_anterior,
            status_novo,
            actor_id,
            observacoes,
            created_at
        ) VALUES (
            NEW.tenant_id,
            NEW.id,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
            NEW.status,
            auth.uid(),
            'Alteração automática via sistema',
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_analise_credito_status ON public.analise_credito;
CREATE TRIGGER trg_audit_analise_credito_status
AFTER INSERT OR UPDATE ON public.analise_credito
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_analise_credito_status();

-- 7. Garantir RLS em todas as tabelas
ALTER TABLE public.analise_credito_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view credit history from their tenant" ON public.analise_credito_historico;
CREATE POLICY "Users can view credit history from their tenant" 
ON public.analise_credito_historico 
FOR SELECT 
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert credit history into their tenant" ON public.analise_credito_historico;
CREATE POLICY "Users can insert credit history into their tenant" 
ON public.analise_credito_historico 
FOR INSERT 
WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage credit docs of their tenant" ON public.analise_credito_documentos;
CREATE POLICY "Users can manage credit docs of their tenant" 
ON public.analise_credito_documentos 
FOR ALL
USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
