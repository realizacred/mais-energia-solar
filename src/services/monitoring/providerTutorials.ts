/**
 * Provider Tutorials — step-by-step guides shown inside the connection modal.
 */

export interface TutorialStep {
  title: string;
  content: string;
}

export interface ProviderTutorial {
  providerId: string;
  modeId: string;
  title: string;
  steps: TutorialStep[];
  notes?: string[];
}

export const PROVIDER_TUTORIALS: ProviderTutorial[] = [
  // ── Solarman Business — API mode ──
  {
    providerId: "solarman_business",
    modeId: "api",
    title: "Como conectar via API",
    steps: [
      {
        title: "Acesse o Solarman Business",
        content: "Entre em home.solarmanpv.com com sua conta de instalador/administrador.",
      },
      {
        title: "Informe suas credenciais",
        content: "Digite o e-mail e senha da sua conta Solarman. A senha é usada apenas para obter um token de acesso e NÃO é armazenada no sistema.",
      },
      {
        title: "Clique em Conectar",
        content: "O sistema vai autenticar na API do Solarman usando credenciais seguras da plataforma (App ID/Secret) e salvar apenas o token de acesso.",
      },
      {
        title: "Sincronize as usinas",
        content: 'Após conectar, clique em "Sincronizar" para importar suas usinas e métricas de produção.',
      },
    ],
    notes: [
      "O App ID e App Secret são gerenciados pela plataforma — você não precisa fornecê-los.",
      "O token de acesso expira periodicamente. Se expirar, basta reconectar.",
    ],
  },

  // ── Solarman Business — Portal mode ──
  {
    providerId: "solarman_business",
    modeId: "portal",
    title: "Como conectar via Portal",
    steps: [
      {
        title: "Acesse o Solarman",
        content: "Entre em home.solarmanpv.com e faça login normalmente.",
      },
      {
        title: "Informe login e senha",
        content: "Use as mesmas credenciais do portal. A senha é usada apenas para autenticação e não é armazenada.",
      },
      {
        title: "Limitações",
        content: "O modo Portal pode ter funcionalidades limitadas dependendo das permissões da sua conta. O modo API é recomendado para acesso completo.",
      },
    ],
    notes: [
      "Se você tem acesso ao App ID e App Secret, prefira o modo API para maior estabilidade.",
    ],
  },

  // ── Solis Cloud ──
  {
    providerId: "solis_cloud",
    modeId: "api",
    title: "Como conectar Solis Cloud",
    steps: [
      {
        title: "Acesse o Solis Cloud",
        content: "Entre em m.ginlong.com ou soliscloud.com com sua conta.",
      },
      {
        title: "Vá em API Management",
        content: 'No menu, procure "API Management" ou "Gerenciamento de API". Se não aparecer, sua conta pode não ter permissão.',
      },
      {
        title: "Gere ou copie suas chaves",
        content: "Copie o API Key e API Secret. Se não houver, clique em gerar.",
      },
      {
        title: "Cole aqui e conecte",
        content: "Informe as chaves no formulário e clique em Conectar.",
      },
    ],
    notes: [
      "Se 'Gerenciamento de API' não aparece, sua conta pode não ter permissão. Peça ao proprietário da conta ou instalador para habilitar.",
      "Em alguns países, é necessário solicitar acesso à API por e-mail para apiservice@ginlong.com.",
    ],
  },

  // ── Growatt ──
  {
    providerId: "growatt",
    modeId: "portal",
    title: "Como conectar Growatt",
    steps: [
      {
        title: "Acesse o ShineServer",
        content: "Entre em server.growatt.com com sua conta.",
      },
      {
        title: "Informe login e senha",
        content: "Use as mesmas credenciais do portal ShineServer.",
      },
    ],
    notes: [
      "A Growatt limita o acesso à API para alguns parceiros. O modo Portal pode ter restrições.",
    ],
  },

  // ── Huawei ──
  {
    providerId: "huawei_fusionsolar",
    modeId: "api",
    title: "Como conectar Huawei FusionSolar",
    steps: [
      {
        title: "Acesse o FusionSolar",
        content: "Entre em intl.fusionsolar.huawei.com com sua conta.",
      },
      {
        title: "Obtenha o System Code",
        content: "No menu, vá em System > Northbound Management e gere um System Code.",
      },
      {
        title: "Informe as credenciais",
        content: "Preencha usuário, senha e o System Code gerado.",
      },
    ],
    notes: [
      "O Northbound Interface precisa ser habilitado pela Huawei. Contate o suporte se não estiver disponível.",
    ],
  },

  // ── GoodWe ──
  {
    providerId: "goodwe_sems",
    modeId: "portal",
    title: "Como conectar GoodWe SEMS",
    steps: [
      {
        title: "Acesse o SEMS Portal",
        content: "Entre em semsportal.com com sua conta.",
      },
      {
        title: "Informe e-mail e senha",
        content: "Use as mesmas credenciais do SEMS Portal.",
      },
    ],
    notes: [
      "O acesso pode variar conforme a região. Em caso de erro, verifique se sua conta está ativa.",
    ],
  },

  // ── Sungrow ──
  {
    providerId: "sungrow",
    modeId: "portal",
    title: "Como conectar Sungrow iSolarCloud",
    steps: [
      {
        title: "Acesse o iSolarCloud",
        content: "Entre em isolarcloud.com com sua conta.",
      },
      {
        title: "Informe e-mail e senha",
        content: "Use as mesmas credenciais do iSolarCloud.",
      },
    ],
    notes: [
      "A API do Sungrow pode exigir aprovação. Contate o suporte da Sungrow se necessário.",
    ],
  },

  // ── SolarEdge ──
  {
    providerId: "solaredge",
    modeId: "api_key",
    title: "Como conectar SolarEdge",
    steps: [
      {
        title: "Acesse o portal SolarEdge",
        content: "Entre em monitoring.solaredge.com e faça login com sua conta.",
      },
      {
        title: "Abra sua conta",
        content: 'Clique no nome do usuário no canto superior direito e selecione "Minha Conta".',
      },
      {
        title: "Vá em Dados da empresa",
        content: 'Dentro de "Minha Conta", clique em "Dados da empresa".',
      },
      {
        title: "Habilite o Acesso à API",
        content: 'Role a página até a seção "Acesso à API". Marque "I have read and agree SolarEdge API T&C" e clique em Salvar.',
      },
      {
        title: "Copie a API Key",
        content: "Após salvar, a API Key será exibida. Copie e cole no campo abaixo.",
      },
    ],
    notes: [
      'Se a seção "Acesso à API" não aparece, sua conta não tem permissão de Administrador. Peça acesso ao instalador ou proprietário do sistema.',
      "O Site ID é opcional — se não informado, o sistema tentará listar todos os sites da conta.",
    ],
  },
];

export function getTutorial(providerId: string, modeId: string): ProviderTutorial | undefined {
  return PROVIDER_TUTORIALS.find((t) => t.providerId === providerId && t.modeId === modeId);
}
