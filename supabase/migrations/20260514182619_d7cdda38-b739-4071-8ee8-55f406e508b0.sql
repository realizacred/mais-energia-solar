
-- Tabela unificada de notificações do usuário
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) NOT NULL,
    user_id UUID NOT NULL, -- Destinatário
    tipo TEXT NOT NULL, -- 'novo_projeto', 'lead', 'atendimento', etc
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    link TEXT,
    lida BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_notif_user_lida ON public.user_notifications(user_id, lida);
CREATE INDEX IF NOT EXISTS idx_user_notif_tenant ON public.user_notifications(tenant_id);

-- RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.user_notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.user_notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
ON public.user_notifications FOR INSERT
TO authenticated, service_role
WITH CHECK (tenant_id = public.current_tenant_id() OR auth.role() = 'service_role');

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
