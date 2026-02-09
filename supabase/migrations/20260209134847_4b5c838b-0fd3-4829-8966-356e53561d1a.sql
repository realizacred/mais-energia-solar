-- Adicionar campo de mensagem padrão do WhatsApp nas configurações do site
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS whatsapp_mensagem_padrao TEXT DEFAULT 'Olá! Vi o site de vocês e gostaria de mais informações sobre energia solar.';