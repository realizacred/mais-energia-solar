-- 1. Criar enum de criticidade e status de pendência
DO $$ BEGIN
    CREATE TYPE public.pendencia_criticidade AS ENUM ('baixa', 'media', 'alta', 'critica');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.pendencia_status AS ENUM ('aberta', 'em_analise', 'aguardando_terceiro', 'resolvida', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criar a tabela de pendências operacionais
CREATE TABLE IF NOT EXISTS public.projeto_pendencias (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    
    tipo TEXT NOT NULL, -- Ex: 'documentacao', 'pagamento', 'vistoria', 'art', 'concessionaria'
    titulo TEXT NOT NULL,
    descricao TEXT,
    
    criticidade public.pendencia_criticidade NOT NULL DEFAULT 'media',
    status public.pendencia_status NOT NULL DEFAULT 'aberta',
    dominio TEXT NOT NULL DEFAULT 'operacional', -- 'comercial', 'engenharia', 'financeiro', 'instalacao'
    
    bloqueia_fluxo BOOLEAN NOT NULL DEFAULT false,
    
    responsavel_id UUID REFERENCES auth.users(id),
    
    prazo TIMESTAMP WITH TIME ZONE,
    sla_at TIMESTAMP WITH TIME ZONE,
    
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID DEFAULT auth.uid()
);

-- 3. Habilitar RLS
ALTER TABLE public.projeto_pendencias ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de segurança
CREATE POLICY "projeto_pendencias_isolation" ON public.projeto_pendencias
    FOR ALL USING (tenant_id = (SELECT current_tenant_id()));

-- 5. Função para marcar resolução automaticamente
CREATE OR REPLACE FUNCTION public.fn_on_pendencia_resolved()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'resolvida' AND OLD.status <> 'resolvida' THEN
        NEW.resolved_at := now();
        NEW.resolved_by := auth.uid();
    ELSIF NEW.status <> 'resolvida' THEN
        NEW.resolved_at := NULL;
        NEW.resolved_by := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_on_pendencia_resolved
    BEFORE UPDATE ON public.projeto_pendencias
    FOR EACH ROW EXECUTE FUNCTION public.fn_on_pendencia_resolved();

-- 6. Trigger de updated_at
CREATE TRIGGER tr_projeto_pendencias_updated_at
    BEFORE UPDATE ON public.projeto_pendencias
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Adicionar índices para performance no Kanban
CREATE INDEX IF NOT EXISTS idx_pendencias_projeto_status ON public.projeto_pendencias(projeto_id, status);
CREATE INDEX IF NOT EXISTS idx_pendencias_tenant_criticidade ON public.projeto_pendencias(tenant_id, criticidade) WHERE status <> 'resolvida';
