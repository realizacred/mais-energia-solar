import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, BookOpen, CheckCircle2, Search, Terminal, AlertTriangle } from "lucide-react";

interface Playbook {
  id: string;
  title: string;
  category: "WhatsApp" | "Financeiro" | "Operacional" | "Infra";
  severity: "Crítico" | "Médio" | "Baixo";
  symptoms: string[];
  causes: string[];
  diagnosis: string;
  sqlQuery?: string;
  solution: string;
  escalation: string;
  risk: string;
}

const playbooks: Playbook[] = [
  {
    id: "wa-backlog",
    title: "WhatsApp Backlog / Mensagens Paradas",
    category: "WhatsApp",
    severity: "Crítico",
    symptoms: ["Mensagens não saem do 'Enviando'", "Clientes reclamam de demora", "Status 'pending' na tabela wa_messages"],
    causes: ["Instância desconectada", "Celular sem internet", "Rate limit do WhatsApp"],
    diagnosis: "Verificar status da instância no Dashboard de Saúde WhatsApp. Checar se 'last_heartbeat' está atualizado.",
    sqlQuery: "SELECT count(*) FROM wa_messages WHERE status = 'pending' AND created_at < now() - interval '5 minutes';",
    solution: "Reiniciar a instância no painel de controle ou reconectar o QR Code.",
    escalation: "Se após reinício persistir, acionar suporte N3 (Infra).",
    risk: "Alto - Interrupção total da comunicação comercial."
  },
  {
    id: "pdf-fail",
    title: "Falha na Geração de PDF",
    category: "Infra",
    severity: "Médio",
    symptoms: ["Botão de 'Gerar PDF' gira infinitamente", "Erro 500 no console", "Arquivo corrompido"],
    causes: ["Edge Function timeout", "Imagens muito pesadas no template", "Variáveis mal formatadas"],
    diagnosis: "Checar logs da Edge Function 'generate-proposal-pdf'. Verificar se o tamanho do payload excede 5MB.",
    solution: "Tentar gerar novamente. Se persistir, simplificar o template removendo imagens de alta resolução.",
    escalation: "Acionar time de Produto se for erro de renderização.",
    risk: "Médio - Atraso no envio de propostas comerciais."
  },
  {
    id: "drift-financeiro",
    title: "Drift Comercial/Financeiro (Mismatch de Valores)",
    category: "Financeiro",
    severity: "Crítico",
    symptoms: ["Valor da proposta diferente do valor do projeto", "Saldo do cliente não bate com lançamentos"],
    causes: ["Exclusão não atômica de versões", "Edição manual de projeto ignorando propostas", "Falha em trigger de atualização"],
    diagnosis: "Comparar 'valor_total' na tabela 'projetos' com a proposta marcada como 'principal' ou 'oficial'.",
    sqlQuery: "SELECT p.id, p.valor_total, pr.valor_final FROM projetos p JOIN propostas pr ON p.proposta_principal_id = pr.id WHERE p.valor_total != pr.valor_final;",
    solution: "Executar RPC 'fix_project_commercial_snapshot' para o ID do projeto afetado.",
    escalation: "Suporte Financeiro / Auditoria se houver suspeita de fraude.",
    risk: "Crítico - Erro em contratos e cobranças reais."
  },
  {
    id: "webhook-stop",
    title: "Webhook de Pagamento Parado",
    category: "Financeiro",
    severity: "Crítico",
    symptoms: ["Pagamento confirmado no banco mas não no CRM", "Webhook logs com erros 4xx/5xx"],
    causes: ["Chave de API expirada", "URL de callback alterada", "Downtime do provedor (Asaas/Stripe)"],
    diagnosis: "Verificar 'webhook_logs' no Supabase. Procurar por entradas sem sucesso nas últimas 2 horas.",
    sqlQuery: "SELECT * FROM webhook_logs WHERE status != 'success' ORDER BY created_at DESC LIMIT 50;",
    solution: "Sincronizar pagamentos manualmente via botão 'Recuperar Pagamentos' no módulo financeiro.",
    escalation: "Infra se for problema de conectividade.",
    risk: "Crítico - Fluxo de caixa e inadimplência falsa."
  }
];

const PlaybooksPage = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Playbooks Operacionais</h1>
        <p className="text-muted-foreground">
          Guia de resolução de incidentes e diagnósticos do sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Playbooks</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playbooks.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Accordion type="single" collapsible className="w-full">
          {playbooks.map((pb) => (
            <AccordionItem key={pb.id} value={pb.id} className="border rounded-lg px-4 mb-2 bg-card">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4 text-left">
                  <div className={`p-2 rounded-full ${
                    pb.severity === 'Crítico' ? 'bg-destructive/10 text-destructive' : 
                    pb.severity === 'Médio' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'
                  }`}>
                    {pb.severity === 'Crítico' ? <AlertCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="font-semibold">{pb.title}</div>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">{pb.category}</Badge>
                      <Badge variant={pb.severity === 'Crítico' ? 'destructive' : 'outline'} className="text-[10px]">
                        {pb.severity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6 space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <section>
                      <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                        <Search className="h-4 w-4 text-primary" /> Sintomas
                      </h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {pb.symptoms.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-warning" /> Causas Prováveis
                      </h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {pb.causes.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-sm font-bold flex items-center gap-2 mb-2 text-info">
                        <CheckCircle2 className="h-4 w-4" /> Diagnóstico
                      </h4>
                      <p className="text-sm text-muted-foreground">{pb.diagnosis}</p>
                    </section>
                  </div>

                  <div className="space-y-4">
                    {pb.sqlQuery && (
                      <section className="bg-muted p-3 rounded-md">
                        <h4 className="text-xs font-mono font-bold flex items-center gap-2 mb-2 uppercase text-muted-foreground">
                          <Terminal className="h-3 w-3" /> Query de Diagnóstico
                        </h4>
                        <pre className="text-[11px] font-mono bg-black/5 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                          {pb.sqlQuery}
                        </pre>
                      </section>
                    )}

                    <section>
                      <h4 className="text-sm font-bold text-success mb-2">Como Resolver</h4>
                      <p className="text-sm p-3 bg-success/5 border border-success/20 rounded-md">{pb.solution}</p>
                    </section>

                    <div className="grid grid-cols-2 gap-4">
                      <section>
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-1">Escalonamento</h4>
                        <p className="text-xs">{pb.escalation}</p>
                      </section>
                      <section>
                        <h4 className="text-xs font-bold uppercase text-muted-foreground mb-1">Risco</h4>
                        <p className="text-xs text-destructive">{pb.risk}</p>
                      </section>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default PlaybooksPage;