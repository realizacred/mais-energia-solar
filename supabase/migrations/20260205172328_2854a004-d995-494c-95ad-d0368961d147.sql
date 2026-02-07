-- Table for WhatsApp automation configuration
CREATE TABLE public.whatsapp_automation_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT NULL,
  api_token TEXT NULL,
  lembrete_dias INTEGER NOT NULL DEFAULT 3,
  lembrete_ativo BOOLEAN NOT NULL DEFAULT true,
  mensagem_boas_vindas TEXT NULL DEFAULT 'Olá {nome}! Sou {vendedor}, da Mais Energia Solar. Recebi seu interesse em energia solar. Posso te ajudar?',
  mensagem_followup TEXT NULL DEFAULT 'Olá {nome}! Passando para saber se ainda tem interesse em energia solar. Posso te enviar uma proposta?',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_automation_config ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin pode gerenciar config WhatsApp"
  ON public.whatsapp_automation_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários autenticados podem ver config WhatsApp"
  ON public.whatsapp_automation_config
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Table for WhatsApp message log
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  orcamento_id UUID NULL REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'automatico', 'lembrete'
  mensagem TEXT NOT NULL,
  telefone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado', -- 'enviado', 'entregue', 'erro'
  erro_detalhes TEXT NULL,
  enviado_por UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Policies for messages
CREATE POLICY "Usuários autenticados podem ver mensagens"
  ON public.whatsapp_messages
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar mensagens"
  ON public.whatsapp_messages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Table for scheduled reminders
CREATE TABLE public.whatsapp_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  orcamento_id UUID NULL REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  vendedor_nome TEXT NULL,
  data_agendada TIMESTAMP WITH TIME ZONE NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'followup', -- 'followup', 'proposta', 'customizado'
  mensagem TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'enviado', 'cancelado'
  created_by UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_reminders ENABLE ROW LEVEL SECURITY;

-- Policies for reminders
CREATE POLICY "Usuários autenticados podem ver lembretes"
  ON public.whatsapp_reminders
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar lembretes"
  ON public.whatsapp_reminders
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar lembretes"
  ON public.whatsapp_reminders
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin/Gerente podem deletar lembretes"
  ON public.whatsapp_reminders
  FOR DELETE
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_automation_config_updated_at
  BEFORE UPDATE ON public.whatsapp_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_reminders_updated_at
  BEFORE UPDATE ON public.whatsapp_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config
INSERT INTO public.whatsapp_automation_config (id) VALUES (gen_random_uuid());