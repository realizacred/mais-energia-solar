import React from "react";
import { HelpCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProviderGuide {
  title: string;
  steps: string[];
  portalUrl: string;
  portalLabel: string;
  warning?: string;
}

const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  solis_cloud: {
    title: "Como obter sua API Key da Solis Cloud",
    steps: [
      "Entre em contato com a Solis pelo WhatsApp (19 9 9961 8000) e solicite a liberação da API",
      "Acesse soliscloud.com → aba 'Serviços'",
      "Clique em 'Gerenciamento de API' → 'Ativar agora'",
      "Aceite os termos e clique em 'Visualizar chave'",
      "Confirme com seu e-mail e copie o Key ID e Key Secret",
    ],
    portalUrl: "https://soliscloud.com",
    portalLabel: "Abrir Solis Cloud",
  },
  deye_cloud: {
    title: "Como criar API no Deye Cloud",
    steps: [
      "Acesse us1.deyecloud.com com sua conta de Integrador",
      "Vá em 'Organização' e copie o 'Nome da empresa' — esse será o campo Grupo",
      "Clique em 'Developer Portal' → 'Sign In'",
      "Selecione seu servidor (Brasil ou Internacional)",
      "Vá em 'Application' → 'Create Application'",
      "Preencha os dados e clique em criar",
      "Copie o AppId e AppSecret gerados",
    ],
    portalUrl: "https://us1.deyecloud.com",
    portalLabel: "Abrir Deye Cloud",
  },
  solaredge: {
    title: "Como obter sua API Key da SolarEdge",
    steps: [
      "Acesse monitoring.solaredge.com e faça login",
      "Clique no seu nome no menu superior → 'Minha conta'",
      "Vá em 'Dados da Empresa'",
      "Role até 'Acesso à API' e aceite os termos",
      "Copie a API Key gerada e clique em 'Salvar'",
    ],
    portalUrl: "https://monitoring.solaredge.com",
    portalLabel: "Abrir SolarEdge",
  },
  sungrow_isolarcloud: {
    title: "Como criar chaves API no Sungrow",
    steps: [
      "Acesse developer-api.isolarcloud.com",
      "Faça login com sua conta iSolarCloud",
      "Vá em 'Applications' → 'Create Application'",
      "Preencha os dados e selecione 'Não usar OAuth2.0'",
      "Aguarde o status 'Review Passed'",
      "Acesse o ícone da aplicação e copie App Key e App Secret",
    ],
    portalUrl: "https://developer-api.isolarcloud.com",
    portalLabel: "Abrir Sungrow Developer",
  },
  fox_ess: {
    title: "Como criar API Key no FoxESS Cloud",
    steps: [
      "Acesse foxesscloud.com e faça login",
      "Clique em 'User Profile' no canto superior direito",
      "Vá em 'API Management'",
      "Clique em 'Generate Api Key'",
      "Copie a API Key gerada e use seu email e senha do portal",
    ],
    portalUrl: "https://www.foxesscloud.com",
    portalLabel: "Abrir FoxESS Cloud",
  },
  livoltek: {
    title: "Como criar token no Livoltek",
    steps: [
      "Acesse o portal Livoltek e faça login",
      "Vá em 'My Profile' (canto superior direito)",
      "Clique em 'Security ID' → 'Add'",
      "Preencha os dados e defina uma data de validade longa (ex: ano 2050)",
      "Copie a API Key e App Secret gerados",
    ],
    portalUrl: "https://www.livoltek-portal.com",
    portalLabel: "Abrir Livoltek",
    warning: "Defina uma data de validade bem no futuro para evitar expiração do token",
  },
  livoltek_cf: {
    title: "Como criar token no Livoltek",
    steps: [
      "Acesse o portal Livoltek e faça login",
      "Vá em 'My Profile' (canto superior direito)",
      "Clique em 'Security ID' → 'Add'",
      "Preencha os dados e defina uma data de validade longa (ex: ano 2050)",
      "Copie a API Key e App Secret gerados",
    ],
    portalUrl: "https://www.livoltek-portal.com",
    portalLabel: "Abrir Livoltek",
    warning: "Defina uma data de validade bem no futuro para evitar expiração do token",
  },
  growatt: {
    title: "Como criar conta Growatt OSS",
    steps: [
      "Acesse oss.growatt.com",
      "Clique em 'Registrar' e selecione 'Instalador'",
      "Preencha os dados da empresa e confirme o e-mail",
      "Anote o Código de Acesso gerado — você vai precisar dele aqui",
      "Use esse código e sua senha para configurar",
    ],
    portalUrl: "https://oss.growatt.com",
    portalLabel: "Abrir Growatt OSS",
  },
  huawei_fusionsolar: {
    title: "Como criar usuário de API no FusionSolar",
    steps: [
      "Acesse intl.fusionsolar.huawei.com e faça login",
      "Vá em Configurações → Gerenciamento de Usuários",
      "Crie um novo usuário especificamente para API",
      "Use esse usuário e senha aqui — não use seu usuário principal",
      "Se o token expirar, basta reconectar com as mesmas credenciais",
    ],
    portalUrl: "https://intl.fusionsolar.huawei.com",
    portalLabel: "Abrir FusionSolar",
    warning: "Crie um usuário dedicado para API. Não use seu login principal",
  },
  hoymiles_s_miles: {
    title: "Como configurar Hoymiles S-Miles",
    steps: [
      "Acesse s-miles.com e faça login com sua conta de instalador",
      "Use o mesmo email e senha do portal S-Miles aqui",
    ],
    portalUrl: "https://s-miles.com",
    portalLabel: "Abrir S-Miles",
  },
};

interface Props {
  providerId: string;
}

export function ProviderSetupGuide({ providerId }: Props) {
  const guide = PROVIDER_GUIDES[providerId];
  if (!guide) return null;

  return (
    <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        <HelpCircle className="w-3.5 h-3.5" />
        {guide.title}
      </p>

      <ol className="space-y-2">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium mt-0.5">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      {guide.warning && (
        <div className="flex gap-2 p-2.5 rounded-md bg-warning/10 border border-warning/20 text-xs text-warning">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {guide.warning}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 w-full"
        onClick={() => window.open(guide.portalUrl, "_blank")}
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {guide.portalLabel}
      </Button>
    </div>
  );
}
