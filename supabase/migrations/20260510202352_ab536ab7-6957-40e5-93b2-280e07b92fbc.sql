-- 1.1 Adicionar colunas em wa_conversations para vínculo e contexto de IA
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposta_id UUID REFERENCES public.propostas_nativas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_context TEXT NOT NULL DEFAULT 'ai_active'
    CHECK (ai_context IN (
      'ai_active',
      'ai_paused',
      'human_active',
      'needs_human_review',
      'waiting_customer',
      'closed',
      'support_context',
      'post_sale_context'
    )),
  ADD COLUMN IF NOT EXISTS ai_context_updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ai_context_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_conv_projeto ON public.wa_conversations(projeto_id) WHERE projeto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_conv_proposta ON public.wa_conversations(proposta_id) WHERE proposta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_conv_ai_context ON public.wa_conversations(ai_context, tenant_id);

-- 1.2 Adicionar rastreabilidade em wa_followup_queue
ALTER TABLE public.wa_followup_queue
  ADD COLUMN IF NOT EXISTS tentativas INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_tentativas INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ultimo_erro TEXT,
  ADD COLUMN IF NOT EXISTS motivo_followup TEXT,
  ADD COLUMN IF NOT EXISTS gatilho TEXT CHECK (gatilho IN (
    'proposta_sem_resposta',
    'projeto_parado',
    'manual',
    'proposta_expirada',
    'pos_visita'
  ));

-- 1.3 Criar tabela de log de contexto (timeline de mudanças operacional)
CREATE TABLE IF NOT EXISTS public.wa_context_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  proposta_id UUID REFERENCES public.propostas_nativas(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  context_anterior TEXT,
  context_novo TEXT,
  origem TEXT CHECK (origem IN ('sistema', 'humano', 'ia', 'automacao')),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.wa_context_events ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por Tenant baseada no JWT/Auth do Lovable Cloud
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'wa_context_events' 
        AND policyname = 'tenant_isolation_wa_context_events'
    ) THEN
        CREATE POLICY "tenant_isolation_wa_context_events"
        ON public.wa_context_events
        FOR ALL USING (tenant_id = (
          SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()
        ));
    END IF;
END $$;

-- Índices de auditoria
CREATE INDEX IF NOT EXISTS idx_wa_ctx_events_conv ON public.wa_context_events(conversation_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_wa_ctx_events_tenant ON public.wa_context_events(tenant_id);
