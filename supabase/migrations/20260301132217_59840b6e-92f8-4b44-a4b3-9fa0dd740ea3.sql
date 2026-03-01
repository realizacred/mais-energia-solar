
-- Update Solis Cloud tutorial with detailed SolarZ-based instructions
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Solicite a liberação do acesso da API com a Solis via WhatsApp (19 9 9961 8000)',
    'No chatbot, siga: Suporte - Pós Venda > Envia SN fictício (10 dígitos) > Monitoramento > Sim > Cadastro na plataforma > Sim > Dúvida (Liberação API)',
    'Solicite atendimento humano para pedir a liberação da API',
    'Após confirmação da Solis, acesse o site SolisCloud e clique na aba "Serviços"',
    'Clique na aba "Gerenciamento de API" e depois em "Ativar agora"',
    'Copie o API ID (KeyID) e API Secret (KeySecret) gerados'
  ),
  'notes', 'Se NÃO aparecer "Gerenciamento de API", sua conta não tem permissão. A conta precisa ser de Instalador ou Proprietário. Solicite habilitação via WhatsApp Solis.'
) WHERE id = 'solis_cloud';

-- Update Growatt tutorial with Growatt OSS details
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse oss.growatt.com e clique em "Registrar" (se ainda não tiver conta)',
    'Selecione a opção "Instalador" e concorde com os termos',
    'Preencha os dados solicitados (telefone no formato +55 XX XXXXX-XXXX)',
    'No modo "Usuário e Senha", use o mesmo login do portal server.growatt.com',
    'Alternativamente, acesse openapi.growatt.com para criar uma API Key (modo recomendado)',
    'No nosso sistema, selecione o modo desejado e preencha os campos'
  ),
  'notes', 'Existem dois modos de conexão: API Key (OpenAPI) recomendado, ou Usuário/Senha (ShineServer). A senha é convertida em hash MD5 e NÃO é armazenada.'
), status = 'available' WHERE id = 'growatt';

-- Update Sungrow tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o Portal de Desenvolvedor Sungrow: https://developer-api.isolarcloud.com/#/home',
    'Faça login com sua conta do iSolarCloud',
    'Acesse a aba "Applications" no canto superior esquerdo',
    'Clique em "Create Application" e preencha os dados da empresa',
    'Selecione a opção "Não" para OAuth2.0 e clique em "Create Application"',
    'Aguarde até que o Status esteja em "Review Passed"',
    'Acesse o ícone de detalhes para obter App Key e App Secret'
  ),
  'notes', 'A aprovação da Sungrow pode levar alguns dias. Após aprovada, as chaves ficarão disponíveis na página da aplicação.'
) WHERE id = 'sungrow_isolarcloud';

-- Update Huawei FusionSolar tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o portal FusionSolar: https://la5.fusionsolar.huawei.com e faça login',
    'Clique em "Mais" no menu superior → "Gerenciamento de empresa"',
    'Selecione a aba "Gestão de API" (disponível apenas para o usuário master)',
    'Clique em "Adicionar" para criar um novo usuário de API',
    'Preencha: Nome (ex: "IntegradorAPI"), Vencimento (data distante)',
    'Crie Usuário e Senha NOVOS (NÃO use os mesmos do login). A senha precisa ter maiúsculas, minúsculas, caracteres especiais e números',
    'Marque a opção "API básica"',
    'Escolha as plantas que deseja monitorar (apenas as selecionadas serão liberadas)',
    'Confirme clicando OK',
    'No nosso sistema, preencha o Usuário de API e a Senha de API criados acima'
  ),
  'notes', 'Cada usuário de Gestão de API suporta no máximo 100 usinas. A senha é usada apenas para gerar o token e NÃO é armazenada.'
) WHERE id = 'huawei_fusionsolar';

-- Update Enphase tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse https://developer-v4.enphase.com/login e crie uma conta (Sign Up)',
    'Use o MESMO e-mail e senha do portal Enphase',
    'Ative a conta através do link enviado por e-mail pela Enphase',
    'Faça login e vá em "My Account" → "Credit card details"',
    'Cadastre um cartão de crédito (obrigatório pela Enphase — recomendamos usar cartão virtual com limite baixo de ~R$50)',
    'Vá em "Applications" e clique em "Create new application"',
    'Preencha as informações, selecione o plano "Partner" e insira seus dados do portal Enphase',
    'Clique em "Create Application" e copie Client ID e Client Secret',
    'Aguarde o status mudar de "Pending" para "Active"'
  ),
  'notes', 'O cartão de crédito é obrigatório pela API Enphase, mas NÃO será cobrado. Use um cartão virtual com limite baixo por segurança. A aprovação pode levar alguns dias.'
) WHERE id = 'enphase';

-- Update FoxESS tutorial  
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse https://www.foxesscloud.com/login e clique em "Sign Up"',
    'Crie uma conta de tipo "Agent" (NÃO use os mesmos dados da conta Installer)',
    'Faça login na conta Agent → vá em "User Profile" → "User" → copie o "Agent Code"',
    'Faça login na conta Installer → vá em "User Profile" → "User"',
    'Em "Bind with Agent", cole o Agent Code copiado e clique "Ok"',
    'Na conta Installer, vá em "New Site" → "My Sites" e vincule as usinas desejadas à conta Agent',
    'No nosso sistema, use o e-mail e senha da conta Agent para conectar'
  ),
  'notes', 'A FoxESS requer uma conta específica de "Agent" separada da conta de Installer. Apenas as usinas vinculadas ao Agent serão acessíveis.'
) WHERE id = 'foxess';

-- Update GoodWe SEMS tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse https://semsportal.com e faça login com sua conta SEMS',
    'No nosso sistema, preencha o e-mail e a senha da sua conta SEMS',
    'As usinas serão detectadas automaticamente após a conexão'
  ),
  'notes', 'A senha é usada apenas para gerar o token de acesso e NÃO é armazenada. Recomendamos criar uma conta exclusiva para integração.'
) WHERE id = 'goodwe_sems';

-- Update Hoymiles tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse https://global.hoymiles.com e faça login com sua conta S-Miles',
    'Vá em "User Profile" ou "API Management" (se disponível)',
    'No nosso sistema, preencha o e-mail e a senha da sua conta Hoymiles',
    'O sistema tentará conectar automaticamente via múltiplos endpoints'
  ),
  'notes', 'A API Hoymiles pode não estar disponível publicamente para todos os tipos de conta. Caso a conexão falhe, entre em contato com o suporte Hoymiles para verificar permissões de API.'
) WHERE id = 'hoymiles_s_miles';

-- Update Deye Cloud tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o portal de desenvolvedor: https://developer.deyecloud.com/',
    'Faça login ou crie uma conta de desenvolvedor',
    'Vá em "Apps" e clique em "Create App"',
    'Copie o App ID e o App Secret gerados',
    'Escolha a região correta: Europa (EU) ou América (US)',
    'No nosso sistema, selecione a região, preencha App ID, App Secret, Email e Senha'
  ),
  'notes', 'A senha é usada apenas para gerar o token de acesso e NÃO é armazenada. Certifique-se de selecionar a região correta (EU ou US).'
) WHERE id = 'deye_cloud';

-- Update SMA tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse https://www.sunnyportal.com e faça login',
    'Vá em Configurações > API Access (Acesso à API)',
    'Gere uma chave de API e copie os dados',
    'No nosso sistema, preencha a API Key gerada'
  ),
  'notes', 'Disponível para inversores SMA com Sunny Portal. Nem todas as contas possuem acesso à API — verifique com seu distribuidor.'
) WHERE id = 'sma';

-- Update Fronius tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse https://www.solarweb.com e faça login',
    'Vá em Configurações > API Access',
    'Gere uma chave de API e copie',
    'No nosso sistema, preencha a API Key'
  ),
  'notes', 'Disponível para contas Fronius Solar.web Pro. A API pode exigir plano pago dependendo da região.'
) WHERE id = 'fronius';

-- Update APsystems tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o portal EMA: https://ema.apsystemsema.com',
    'Faça login com suas credenciais do app EMA Manager',
    'No nosso sistema, use o e-mail e senha da sua conta APsystems'
  ),
  'notes', 'Use as mesmas credenciais do aplicativo EMA Manager. As usinas serão detectadas automaticamente.'
) WHERE id = 'apsystems';

-- Update Sofar Solar tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o portal Sofar/SolarMAN: https://home.solarmanpv.com',
    'Faça login com sua conta Sofar',
    'No nosso sistema, use o e-mail e senha da sua conta Sofar'
  ),
  'notes', 'Use as credenciais do portal SolarMAN/Sofar. A senha é usada apenas para gerar o token e NÃO é armazenada.'
) WHERE id = 'sofar_solar';

-- Update Victron tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse https://vrm.victronenergy.com e faça login',
    'Vá em Settings > Access Tokens',
    'Crie um novo token de acesso e copie',
    'No nosso sistema, cole o token gerado'
  ),
  'notes', 'O token VRM pode ter diferentes níveis de permissão. Certifique-se de criar um token com acesso de leitura às instalações desejadas.'
) WHERE id = 'victron';

-- Update Canadian Solar tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o portal CSI Monitor (Canadian Solar)',
    'Solicite acesso à API via suporte Canadian Solar',
    'Forneça os dados da empresa e instalações',
    'Após aprovação, copie as credenciais de API recebidas'
  ),
  'notes', 'A API Canadian Solar geralmente requer solicitação formal via suporte. O prazo de aprovação pode variar.'
) WHERE id = 'canadian_solar';

-- Update ABB/FIMER tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse https://www.auroravision.net e faça login',
    'Vá em Account > API Access',
    'Gere uma chave de API e copie',
    'No nosso sistema, preencha a API Key'
  ),
  'notes', 'Disponível para inversores ABB/FIMER com Aurora Vision Plant Management.'
) WHERE id = 'abb_fimer';

-- Update Trina Solar tutorial
UPDATE integration_providers SET tutorial = jsonb_build_object(
  'steps', jsonb_build_array(
    'Acesse o portal TrinaTracker / Trina Solar Cloud',
    'Solicite credenciais de API via suporte Trina Solar',
    'Após aprovação, copie as chaves fornecidas'
  ),
  'notes', 'A API Trina Solar geralmente requer solicitação formal. Entre em contato com o suporte ou representante comercial.'
) WHERE id = 'trina_solar';
