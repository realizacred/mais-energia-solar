-- Insert Gotenberg as an integration provider
INSERT INTO integration_providers (
  id, category, label, description, logo_key, status, auth_type,
  credential_schema, tutorial, capabilities, platform_managed_keys, popularity
) VALUES (
  'gotenberg',
  'api',
  'Gotenberg (PDF)',
  'Conversão de DOCX para PDF via LibreOffice — servidor self-hosted',
  'FileText',
  'available',
  'url',
  '[]'::jsonb,
  '{
    "steps": [
      "Instale o Gotenberg via Docker: docker run -d --name gotenberg -p 3000:3000 --restart always gotenberg/gotenberg:7",
      "Verifique se está rodando acessando http://SEU_IP:3000/health no navegador",
      "No campo URL base, insira apenas o endereço raiz, ex: http://45.92.11.134:3000",
      "NÃO inclua /health ou /forms/libreoffice/convert na URL",
      "Use http:// ou https:// obrigatoriamente",
      "Em produção, recomenda-se usar um subdomínio dedicado (ex: https://gotenberg.seudominio.com)"
    ],
    "notes": "O sistema gera o DOCX da proposta, envia ao Gotenberg para conversão, recebe o PDF e salva no storage. O DOCX é sempre persistido independente da conversão."
  }'::jsonb,
  '{"docx_to_pdf": true, "health_check": true}'::jsonb,
  true,
  90
) ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  tutorial = EXCLUDED.tutorial,
  capabilities = EXCLUDED.capabilities,
  updated_at = now();