-- Update Huawei FusionSolar tutorial with detailed steps
UPDATE integration_providers
SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o portal FusionSolar: https://la5.fusionsolar.huawei.com e faça login',
    'Clique em "Mais" no menu superior → "Gerenciamento de empresa"',
    'Selecione a aba "Gestão de API" (disponível apenas para o usuário master)',
    'Clique em "Adicionar" para criar um novo usuário de API',
    'Preencha: Nome (ex: SolarZAPI), Vencimento (data distante), Usuário e Senha NOVOS (não use os do login)',
    'A senha precisa ter maiúsculas, minúsculas, caracteres especiais e números',
    'Marque a opção "API básica"',
    'Escolha as plantas que deseja monitorar (apenas as selecionadas serão liberadas)',
    'Confirme clicando OK',
    'No nosso sistema, preencha o Usuário de API e a Senha de API criados acima'
  ),
  'notes', 'Cada usuário de Gestão de API suporta no máximo 100 usinas. A senha é usada apenas para gerar o token e NÃO é armazenada.'
),
updated_at = now()
WHERE id = 'huawei_fusionsolar';

-- Update GoodWe SEMS tutorial
UPDATE integration_providers
SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Use o mesmo e-mail e senha do portal SEMS (https://semsportal.com)',
    'No nosso sistema, preencha o e-mail e a senha da sua conta SEMS',
    'As usinas serão detectadas automaticamente após a conexão'
  ),
  'notes', 'A senha é usada apenas para gerar o token de acesso e NÃO é armazenada.'
),
updated_at = now()
WHERE id = 'goodwe_sems';

-- Update Deye Cloud tutorial with better steps
UPDATE integration_providers
SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o portal de desenvolvedor: https://developer.deyecloud.com/',
    'Faça login ou crie uma conta',
    'Vá em "Apps" e clique em "Create App"',
    'Copie o App ID e o App Secret gerados',
    'Escolha a região correta: Europa (EU) ou América (US)',
    'No nosso sistema, selecione a região, preencha App ID, App Secret, Email e Senha'
  ),
  'notes', 'A senha é usada apenas para gerar o token de acesso e NÃO é armazenada.'
),
updated_at = now()
WHERE id = 'deye_cloud';