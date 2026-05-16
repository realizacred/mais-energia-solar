-- 1. Migração de Dados (Idempotente)
INSERT INTO public.credit_bank_configs (
    tenant_id, 
    bank_name, 
    slug, 
    is_active, 
    prazo_medio, 
    observacoes,
    created_at,
    updated_at
)
SELECT 
    tenant_id, 
    nome as bank_name, 
    lower(regexp_replace(nome, '[^a-zA-Z0-9]+', '-', 'g')) as slug,
    ativo as is_active,
    max_parcelas::text || ' meses' as prazo_medio,
    'Migrado do legado. Taxa Mensal: ' || taxa_mensal || '%' as observacoes,
    COALESCE(created_at, now()),
    COALESCE(updated_at, now())
FROM public.financiamento_bancos f
WHERE NOT EXISTS (
    SELECT 1 FROM public.credit_bank_configs c 
    WHERE c.bank_name = f.nome 
    AND c.tenant_id = f.tenant_id
);

-- 2. Preservar campos técnicos no JSONB de configuração se necessário (opcional, mas recomendado para DA-48)
-- Poderíamos adicionar uma coluna de metadados, mas a credit_bank_configs atual é simples.
-- Vamos garantir que os hooks apontem para a nova.

-- 3. Renomear tabela legada para evitar uso indevido
ALTER TABLE public.financiamento_bancos RENAME TO _deprecated_financiamento_bancos;

-- 4. Adicionar colunas de suporte técnico para integração bancária futuro (Bank Operations Core)
ALTER TABLE public.credit_bank_configs 
ADD COLUMN IF NOT EXISTS technical_metadata JSONB DEFAULT '{}'::jsonb;

-- Mapear dados técnicos migrados para o JSONB
UPDATE public.credit_bank_configs c
SET technical_metadata = jsonb_build_object(
    'taxa_mensal', f.taxa_mensal,
    'max_parcelas', f.max_parcelas,
    'codigo_bcb', f.codigo_bcb,
    'api_customizada_url', f.api_customizada_url,
    'fonte_sync', f.fonte_sync,
    'ultima_sync', f.ultima_sync
)
FROM public._deprecated_financiamento_bancos f
WHERE c.bank_name = f.nome AND c.tenant_id = f.tenant_id;
