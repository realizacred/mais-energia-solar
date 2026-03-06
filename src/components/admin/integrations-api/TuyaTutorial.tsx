/**
 * TuyaTutorial — Visual step-by-step guide for configuring Tuya integration.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ExternalLink, CheckCircle2, BookOpen, AlertTriangle } from "lucide-react";

const STEPS = [
  {
    num: 1,
    title: "Criar conta no Tuya IoT Platform",
    desc: 'Acesse iot.tuya.com e crie uma conta de desenvolvedor. Escolha o plano "Trial" (gratuito para desenvolvimento).',
    link: "https://iot.tuya.com",
  },
  {
    num: 2,
    title: "Criar Cloud Project",
    desc: 'No menu "Cloud > Development", clique em "Create Cloud Project". Escolha "Smart Home" como Industry e selecione seu Data Center (Europa para o Brasil).',
  },
  {
    num: 3,
    title: "Vincular App e Dispositivos",
    desc: 'Na aba "Devices" do projeto, vincule o app Tuya Smart ou Smart Life. Os medidores cadastrados no app aparecerão automaticamente.',
  },
  {
    num: 4,
    title: "Copiar Access ID (Client ID)",
    desc: 'Na aba "Overview" do projeto cloud, copie o campo "Access ID/Client ID".',
  },
  {
    num: 5,
    title: "Copiar Access Secret (Client Secret)",
    desc: 'Na mesma página, copie o "Access Secret/Client Secret". Guarde em local seguro.',
  },
  {
    num: 6,
    title: "Escolher Região / Data Center",
    desc: "Selecione a região correspondente ao Data Center do projeto. Para o Brasil, normalmente é Europa (EU) ou América (US).",
  },
  {
    num: 7,
    title: "Colar Credenciais no Sistema",
    desc: 'Clique em "Nova Integração", selecione Tuya Smart, cole o Client ID e Client Secret, e escolha a região.',
  },
  {
    num: 8,
    title: "Testar Conexão",
    desc: 'Clique em "Testar Conexão" para verificar se as credenciais estão corretas e a autenticação funciona.',
  },
  {
    num: 9,
    title: "Importar Medidores",
    desc: 'Clique em "Importar Medidores" para sincronizar os dispositivos da sua conta Tuya com o sistema.',
  },
  {
    num: 10,
    title: "Vincular Medidores às UCs",
    desc: "Em Medidores ou no detalhe da UC, vincule cada medidor importado à Unidade Consumidora correspondente.",
  },
];

export function TuyaTutorial() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-orange-200 dark:border-orange-800/40">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-500" />
            Como integrar com a Tuya
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {STEPS.map((step) => (
              <div key={step.num} className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{step.num}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Acessar site
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Observação</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Nem todos os modelos de medidores Tuya expõem dados de energia exportada (injeção).
                  Medidores como o RMDZW-3PNB 100A geralmente suportam importação, tensão, corrente e potência.
                  A disponibilidade de dados depende do firmware e categoria do dispositivo.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
