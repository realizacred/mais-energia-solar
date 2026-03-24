
-- Tabela de configuração de mensagens de proposta por tenant
-- Abordagem: 1 registro por tenant com JSONB para templates, blocos e defaults
-- Escalável e simples de evoluir

CREATE TABLE public.proposal_message_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Templates customizados por modo/estilo (null = usar default do sistema)
  templates JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Exemplo: { "cliente_curta": "Olá {{cliente_nome}}...", "cliente_completa": "...", ... }
  
  -- Blocos habilitados/desabilitados por modo/estilo
  blocks_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Exemplo: { "saudacao": { "enabled": true, "modes": ["cliente","consultor"], "styles": ["curta","completa"] }, ... }
  
  -- Defaults operacionais
  defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Exemplo: { "mode": "cliente", "style": "completa", "channel": "copiar", "empresa_nome": "...", "oferta_especial": "..." }
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_proposal_message_config_tenant UNIQUE (tenant_id)
);

-- RLS
ALTER TABLE public.proposal_message_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_message_config_tenant_isolation"
  ON public.proposal_message_config
  FOR ALL
  USING (tenant_id = get_user_tenant_id() AND tenant_is_active())
  WITH CHECK (tenant_id = get_user_tenant_id());

-- Index
CREATE INDEX idx_proposal_message_config_tenant ON public.proposal_message_config(tenant_id);
