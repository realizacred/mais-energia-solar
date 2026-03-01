
UPDATE integration_providers
SET credential_schema = jsonb_build_array(
  jsonb_build_object(
    'key', 'region',
    'label', 'Data Center (Região)',
    'type', 'select',
    'required', true,
    'placeholder', 'Selecione a região',
    'options', jsonb_build_array(
      jsonb_build_object('value', 'EU', 'label', 'EMEA (Europa/África)'),
      jsonb_build_object('value', 'US', 'label', 'US (Estados Unidos)'),
      jsonb_build_object('value', 'AMEA', 'label', 'AMEA (Américas)'),
      jsonb_build_object('value', 'INDIA', 'label', 'Índia')
    )
  ),
  jsonb_build_object('key', 'appId', 'label', 'App ID', 'type', 'text', 'required', true, 'placeholder', 'Ex: 202603018500002'),
  jsonb_build_object('key', 'appSecret', 'label', 'App Secret', 'type', 'password', 'required', true, 'placeholder', 'Secret da aplicação'),
  jsonb_build_object('key', 'email', 'label', 'Email da conta Deye', 'type', 'text', 'required', true, 'placeholder', 'seu@email.com'),
  jsonb_build_object('key', 'password', 'label', 'Senha', 'type', 'password', 'required', true, 'placeholder', 'Senha da conta DeyeCloud', 'helperText', 'A senha será criptografada (SHA256) antes do envio.'),
  jsonb_build_object('key', 'companyId', 'label', 'Company ID (Business Member)', 'type', 'text', 'required', false, 'placeholder', 'Opcional — ex: 963', 'helperText', 'Apenas para contas Business Member. Se omitido, será detectado automaticamente.')
)
WHERE id = 'deye_cloud';
