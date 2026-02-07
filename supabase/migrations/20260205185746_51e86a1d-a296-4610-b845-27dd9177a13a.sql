-- Tabela para templates de automação de WhatsApp
CREATE TABLE public.whatsapp_automation_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('boas_vindas', 'mudanca_status', 'inatividade', 'agendamento', 'parcela_vencimento', 'avaliacao_pos_instalacao')),
  gatilho_config JSONB NOT NULL DEFAULT '{}',
  mensagem TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para log de automações disparadas
CREATE TABLE public.whatsapp_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.whatsapp_automation_templates(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  servico_id UUID REFERENCES public.servicos_agendados(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL,
  mensagem_enviada TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'erro', 'cancelado')),
  erro_detalhes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_automation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_automation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para templates
CREATE POLICY "Admin/Gerente podem gerenciar templates de automação"
ON public.whatsapp_automation_templates
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Usuários autenticados podem ver templates ativos"
ON public.whatsapp_automation_templates
FOR SELECT
USING (auth.role() = 'authenticated' AND ativo = true);

-- RLS Policies para logs
CREATE POLICY "Admin/Gerente podem ver logs de automação"
ON public.whatsapp_automation_logs
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'gerente'::app_role]));

CREATE POLICY "Sistema pode inserir logs"
ON public.whatsapp_automation_logs
FOR INSERT
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_whatsapp_automation_templates_updated_at
BEFORE UPDATE ON public.whatsapp_automation_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates padrão
INSERT INTO public.whatsapp_automation_templates (nome, tipo, gatilho_config, mensagem, ativo, ordem) VALUES
('Boas-vindas ao novo lead', 'boas_vindas', '{"delay_minutos": 0}', 'Olá {nome}! 👋 Obrigado pelo seu interesse em energia solar. Em breve um de nossos consultores entrará em contato. Somos a Mais Energia Solar! ☀️', true, 1),
('Confirmação de visita técnica', 'agendamento', '{"horas_antes": 24}', 'Olá {nome}! 📅 Lembramos que sua visita técnica está agendada para amanhã. Nosso instalador estará no local no horário combinado. Até lá! ☀️', true, 2),
('Lembrete de inatividade (3 dias)', 'inatividade', '{"dias_sem_contato": 3}', 'Olá {nome}! 👋 Passando para saber se ainda tem interesse em energia solar. Posso ajudar com alguma dúvida? Estamos à disposição! ☀️', true, 3),
('Lead movido para Negociação', 'mudanca_status', '{"status_destino": "Negociação"}', 'Olá {nome}! 🎉 Ficamos felizes em avançar com você! Nosso consultor já está preparando sua proposta personalizada. Em breve entraremos em contato! ☀️', true, 4);

-- Adicionar coluna na config para habilitar automações
ALTER TABLE public.whatsapp_automation_config 
ADD COLUMN IF NOT EXISTS automacoes_ativas BOOLEAN NOT NULL DEFAULT false;