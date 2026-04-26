
-- 1) Renomear/clarificar o Evolution existente como "Classic"
UPDATE public.integration_providers
SET label = 'WhatsApp (Evolution Classic)',
    description = 'Envio e recebimento via Evolution API Classic (endpoints /message/...). Configurado em Instâncias WhatsApp.',
    updated_at = now()
WHERE id = 'whatsapp_evolution';

-- 2) Adicionar Evolution GO como integração separada (idempotente)
INSERT INTO public.integration_providers (
  id, category, label, description, logo_key, status, auth_type,
  credential_schema, tutorial, capabilities, platform_managed_keys, popularity
) VALUES (
  'whatsapp_evolution_go',
  'messaging',
  'WhatsApp (Evolution GO)',
  'Envio e recebimento via Evolution GO (endpoints /send/...). Configurado em Instâncias WhatsApp escolhendo o tipo de API "GO".',
  'MessageCircle',
  'available',
  'api_key',
  '[]'::jsonb,
  jsonb_build_object(
    'notes', 'Gerenciado na seção Instâncias WhatsApp. Ao criar a instância, selecione o Tipo de API: GO.',
    'steps', jsonb_build_array('Acesse Instâncias WhatsApp', 'Crie uma nova instância', 'Selecione Tipo de API: GO', 'Informe a URL e API Key da sua Evolution GO', 'Gere o QR Code para conectar')
  ),
  jsonb_build_object('send_message', true, 'receive_message', true),
  false,
  98
)
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    tutorial = EXCLUDED.tutorial,
    capabilities = EXCLUDED.capabilities,
    status = EXCLUDED.status,
    updated_at = now();
