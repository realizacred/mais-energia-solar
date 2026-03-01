/**
 * Provider Tutorials — static fallback text guides shown inside the connection modal.
 * The DB-first approach (integration_providers.tutorial JSONB) takes priority.
 * Each key maps to a provider ID from providerRegistry / integration_providers.
 */

export const PROVIDER_TUTORIALS: Record<string, string> = {
  solarman_business_api:
    `Para conectar Solarman Business via API:
1) Você precisa de App ID e App Secret (modo Developer/OpenAPI).
2) Acesse o portal Solarman Pro/Developer e gere o App (App ID / App Secret).
3) No nosso sistema, preencha App ID, App Secret, Email e Senha.
Obs: a senha é enviada como SHA-256 para autenticação e NÃO é armazenada.`,

  solis_cloud:
    `Para conectar SolisCloud:
1) Solicite a liberação do acesso da API com a Solis via WhatsApp (19 9 9961 8000).
2) No chatbot, siga: Suporte - Pós Venda > SN fictício (10 dígitos) > Monitoramento > Sim > Cadastro na plataforma > Sim > Dúvida (Liberação API).
3) Solicite atendimento humano para pedir a liberação.
4) Após confirmação, acesse SolisCloud → aba "Serviços" → "Gerenciamento de API" → "Ativar agora".
5) Copie o API ID (KeyID) e API Secret (KeySecret).
Se NÃO aparecer "Gerenciamento de API", solicite habilitação via WhatsApp Solis. Conta precisa ser Instalador ou Proprietário.`,

  deye_cloud:
    `Como obter credenciais do Deye Cloud:
1) Acesse o portal de desenvolvedor: https://developer.deyecloud.com/
2) Faça login ou crie uma conta.
3) Vá em "Apps" e clique em "Create App".
4) Copie o App ID e o App Secret gerados.
5) Escolha a região correta: Europa (EU) ou América (US).
6) No nosso sistema, selecione a região, preencha App ID, App Secret, Email e Senha.
Privacidade: a senha é usada apenas para gerar o token e NÃO é armazenada.`,

  solaredge:
    `Para conectar SolarEdge:
1) Acesse monitoring.solaredge.com e faça login.
2) Clique no seu nome → Minha conta → Dados da Empresa.
3) No painel "Acesso à API", marque que concorda com os termos (API T&C) e salve.
4) Copie a API KEY.
Sites serão detectados automaticamente.`,

  growatt:
    `Para conectar Growatt existem dois modos:

▸ Modo API Key (recomendado):
1) Acesse https://openapi.growatt.com e faça login.
2) Crie uma aplicação e copie a API Key gerada.

▸ Modo Usuário/Senha (ShineServer):
1) Acesse oss.growatt.com e registre-se como "Instalador" (se ainda não tiver conta).
2) Use o mesmo usuário e senha do portal server.growatt.com.
3) No nosso sistema, selecione "Usuário e Senha" e preencha os campos.

Privacidade: a senha é convertida em hash MD5 e NÃO é armazenada.`,

  huawei_fusionsolar:
    `Para conectar Huawei FusionSolar:
1) Acesse o portal: https://la5.fusionsolar.huawei.com e faça login.
2) Clique em "Mais" → "Gerenciamento de empresa".
3) Selecione a aba "Gestão de API" (disponível apenas para o usuário master).
4) Clique em "Adicionar" para criar um novo usuário de API.
5) Preencha: Nome (ex: "IntegradorAPI"), Vencimento (data distante).
6) Crie Usuário e Senha NOVOS (NÃO use os do login). Precisa ter maiúsculas, minúsculas, especiais e números.
7) Marque "API básica" e escolha as plantas desejadas.
8) Confirme clicando OK.
Cada usuário de API suporta no máximo 100 usinas. Senha usada apenas para gerar token — NÃO armazenada.`,

  goodwe_sems:
    `Para conectar GoodWe SEMS:
1) Acesse https://semsportal.com e faça login.
2) No nosso sistema, preencha o e-mail e a senha da sua conta SEMS.
3) As usinas serão detectadas automaticamente após a conexão.
Privacidade: a senha é usada apenas para gerar o token e NÃO é armazenada.`,

  enphase:
    `Para conectar Enphase:
1) Acesse https://developer-v4.enphase.com/login e crie uma conta (Sign Up).
2) Use o MESMO e-mail e senha do portal Enphase.
3) Ative a conta via link enviado por e-mail.
4) Faça login → "My Account" → "Credit card details" → cadastre um cartão (obrigatório pela Enphase).
   Obs: NÃO será cobrado. Recomendamos cartão virtual com limite baixo (~R$50).
5) Vá em "Applications" → "Create new application".
6) Selecione plano "Partner", insira dados do portal Enphase.
7) Copie Client ID e Client Secret.
8) Aguarde status mudar de "Pending" para "Active".`,

  foxess:
    `Para conectar FoxESS Cloud:
1) Acesse https://www.foxesscloud.com/login → "Sign Up".
2) Crie uma conta de tipo "Agent" (dados diferentes da conta Installer).
3) Login na conta Agent → "User Profile" → "User" → copie o "Agent Code".
4) Login na conta Installer → "User Profile" → "User" → em "Bind with Agent", cole o Agent Code.
5) Na conta Installer, vá em "New Site" → "My Sites" e vincule as usinas à conta Agent.
6) No nosso sistema, use o e-mail e senha da conta Agent.
Obs: Apenas usinas vinculadas ao Agent serão acessíveis.`,

  sungrow_isolarcloud:
    `Para conectar Sungrow iSolarCloud:
1) Acesse o Portal de Desenvolvedor: https://developer-api.isolarcloud.com/#/home
2) Faça login com sua conta do iSolarCloud.
3) Acesse a aba "Applications" no canto superior esquerdo.
4) Clique em "Create Application" e preencha os dados da empresa.
5) Selecione "Não" para OAuth2.0 e clique em "Create Application".
6) Aguarde o Status mudar para "Review Passed".
7) Acesse o ícone de detalhes para obter App Key e App Secret.
Obs: A aprovação da Sungrow pode levar alguns dias.`,

  hoymiles_s_miles:
    `Para conectar Hoymiles S-Miles:
1) Acesse https://global.hoymiles.com e faça login com sua conta S-Miles.
2) No nosso sistema, preencha o e-mail e a senha da sua conta Hoymiles.
3) O sistema tentará conectar automaticamente.
Obs: A API pode não estar disponível para todos os tipos de conta. Caso falhe, contate o suporte Hoymiles.`,

  sma:
    `Para conectar SMA (Sunny Portal):
1) Acesse https://www.sunnyportal.com e faça login.
2) Vá em Configurações > API Access.
3) Gere uma chave de API e copie.
Obs: Nem todas as contas possuem acesso à API — verifique com seu distribuidor.`,

  fronius:
    `Para conectar Fronius Solar.web:
1) Acesse https://www.solarweb.com e faça login.
2) Vá em Configurações > API Access.
3) Gere uma chave de API e copie.
Obs: A API pode exigir plano pago dependendo da região.`,

  apsystems:
    `Para conectar APsystems (EMA):
1) Acesse o portal EMA: https://ema.apsystemsema.com
2) Faça login com suas credenciais do app EMA Manager.
3) No nosso sistema, use o e-mail e senha da sua conta APsystems.`,

  sofar_solar:
    `Para conectar Sofar Solar:
1) Acesse o portal SolarMAN: https://home.solarmanpv.com
2) Faça login com sua conta Sofar.
3) No nosso sistema, use o e-mail e senha da sua conta Sofar.
Privacidade: a senha é usada apenas para gerar o token e NÃO é armazenada.`,

  victron:
    `Para conectar Victron Energy (VRM):
1) Acesse https://vrm.victronenergy.com e faça login.
2) Vá em Settings > Access Tokens.
3) Crie um novo token de acesso e copie.
4) No nosso sistema, cole o token gerado.`,

  canadian_solar:
    `Para conectar Canadian Solar (CSI Monitor):
1) Acesse o portal CSI Monitor.
2) Solicite acesso à API via suporte Canadian Solar.
3) Após aprovação, copie as credenciais de API recebidas.
Obs: Requer solicitação formal via suporte. Prazo pode variar.`,

  abb_fimer:
    `Para conectar ABB/FIMER (Aurora Vision):
1) Acesse https://www.auroravision.net e faça login.
2) Vá em Account > API Access.
3) Gere uma chave de API e copie.`,

  trina_solar:
    `Para conectar Trina Solar:
1) Acesse o portal TrinaTracker / Trina Solar Cloud.
2) Solicite credenciais de API via suporte Trina Solar.
3) Após aprovação, copie as chaves fornecidas.`,

  weg_solar:
    `Para conectar WEG Solar:
1) Acesse o WEG Solar Portal: https://solarportal.weg.net/ com seu usuário e senha.
2) No menu lateral, clique em "Gestão de API".
3) Clique em "Adicionar chave de API".
4) Preencha: Descrição e selecione as plantas vinculadas (apenas plantas com perfil administrador).
5) Clique em "Salvar".
6) Copie a API Key e API Secret exibidos (exibidos apenas uma vez!).
Obs: Armazene o API Secret com segurança — não será possível recuperá-lo depois.`,

  solplanet:
    `Para conectar Solplanet Pro:
1) Crie uma conta no portal Solplanet (se ainda não tiver).
2) Envie e-mail para service.latam@solplanet.net (ou WhatsApp +55 11 93041-1888) solicitando:
   - Criação de usuário API
   - Liberação das interfaces de lista de plantas e dispositivos
3) Aguarde receber o User Token por e-mail.
4) Após liberação, acesse Configurações do perfil para obter APP KEY e APP SECRET.
5) No nosso sistema, preencha os campos com as credenciais recebidas.`,

  hyxipower:
    `Para conectar HyxiPower:
1) Crie uma conta de desenvolvedor em: https://open.hyxicloud.com/#/login
2) Use o MESMO e-mail do portal HyxiPower (de preferência mesma senha).
3) Se a conta já existir, faça login com os dados do portal HyxiPower.
4) Após login, clique no canto superior direito → "Authentication".
5) Clique no botão para criar um novo App Key.
6) Insira um nome para a aplicação e clique em "Confirm".
7) Copie o App Key e App Secret (o secret só é visível neste momento!).
8) No nosso sistema, preencha os campos com as credenciais.`,
};

export function getTutorial(providerId: string): string | undefined {
  return PROVIDER_TUTORIALS[providerId];
}
