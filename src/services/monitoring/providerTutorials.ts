/**
 * Provider Tutorials — text guides shown inside the connection modal.
 * Each key maps to a provider ID from providerRegistry.
 */

export const PROVIDER_TUTORIALS: Record<string, string> = {
  solarman_business_api:
    `Para conectar Solarman Business via API:
1) Você precisa de App ID e App Secret (modo Developer/OpenAPI).
2) Acesse o portal Solarman Pro/Developer e gere o App (App ID / App Secret).
3) No nosso sistema, preencha App ID, App Secret, Email e Senha (a senha é usada só para autenticar; NÃO armazenamos senha).
Obs: a senha é enviada como SHA-256 para autenticação.`,

  solis_cloud:
    `Para conectar SolisCloud:
1) Faça login no SolisCloud (navegador).
2) Vá em Configurações básicas (Basic Settings).
3) Procure 'Gerenciamento de API / API Management'.
4) Ative e copie KeyID (API Key) e KeySecret (API Secret).
Se NÃO aparecer 'API Management', sua conta não tem permissão (geralmente precisa ser Instalador/Proprietário).`,

  solaredge:
    `Para conectar SolarEdge:
1) Acesse monitoring.solaredge.com e faça login.
2) Clique no seu nome → Minha conta → Dados da Empresa.
3) No painel 'Acesso à API', marque que concorda com os termos (API T&C) e salve.
4) Copie a API KEY.
Opcional: Site ID pode ser necessário dependendo do endpoint/relatórios.`,

  growatt:
    `Growatt (Em breve):
Em muitos cenários é possível gerar um API token no portal Growatt (Settings → Account Management → API Key). Use esse token para acesso a plantas e dados.`,

  huawei_fusionsolar:
    `Huawei FusionSolar (Em breve):
Integração via OpenAPI/OAuth. Requer app/credenciais e fluxo de token. Prepare usuário, senha e dados do portal FusionSolar; o acesso pode exigir habilitação.`,

  goodwe_sems:
    `GoodWe SEMS (Em breve):
Normalmente usa autenticação via portal SEMS e token. Prepare usuário e senha do SEMS; algumas integrações exigem Plant ID.`,

  sungrow_isolarcloud:
    `Sungrow iSolarCloud (Em breve):
Geralmente requer App Key/Access Key via portal de desenvolvedor e/ou solicitação de credenciais. Prepare login do iSolarCloud e Plant ID.`,

  hoymiles_s_miles:
    `Hoymiles (Em breve):
Com frequência a API oficial não é pública para clientes finais; pode exigir contrato/documentação específica. Prepare dados do S-Miles Cloud e permissões do instalador.`,
};

export function getTutorial(providerId: string): string | undefined {
  return PROVIDER_TUTORIALS[providerId];
}
