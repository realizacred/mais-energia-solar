import React from "react";
import { ShieldCheck, Database, Zap, ArrowRight, History, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const CRITICAL_RPCS = [
  { name: "proposal_delete", risk: "alto", impact: "Exclui propostas e sincroniza deals" },
  { name: "set_proposta_principal", risk: "médio", impact: "Troca proposta principal e atualiza valores" },
  { name: "venda_transacional_create", risk: "crítico", impact: "Cria registro financeiro de venda" },
  { name: "recibo_gerar", risk: "médio", impact: "Gera documento fiscal/operacional" }
];

const RECENT_CHANGES = [
  { type: "migration", title: "Hard Lock Financeiro", date: "Há 10 min", status: "sucesso" },
  { type: "rpc", title: "proposal_delete v2", date: "Há 30 min", status: "sucesso" },
  { type: "ui", title: "Operational Health Center", date: "Há 1 hora", status: "sucesso" }
];

export default function GovernancePage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Governança & Controle
          </h1>
          <p className="text-muted-foreground">Monitoramento de ativos críticos e segurança operacional</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-success/5 text-success border-success/20 py-1.5 px-3">
            SSOT Compliance: OK
          </Badge>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 py-1.5 px-3">
            RBAC: Ativo
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* RPCs Críticas */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-warning" />
              RPCs e Funções Críticas
            </CardTitle>
            <Badge variant="outline">Motor de Negócio</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {CRITICAL_RPCS.map((rpc) => (
                <div key={rpc.name} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-bold text-primary">{rpc.name}</code>
                      <Badge variant={rpc.risk === "crítico" ? "destructive" : rpc.risk === "alto" ? "warning" : "outline"} className="text-[10px]">
                        {rpc.risk.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{rpc.impact}</p>
                  </div>
                  <Button variant="ghost" size="sm">Logs</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Auditoria de Alterações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-info" />
              Alterações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {RECENT_CHANGES.map((change, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-1">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{change.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="h-4">{change.type}</Badge>
                      <span>{change.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checklists de Governança */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-warning">
          <CardHeader>
            <CardTitle className="text-md font-bold">Checklist Pré-Deploy / Migration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Validar impacto cross-tenant em queries globais",
              "Verificar se novas colunas têm defaults seguros",
              "Testar RLS para garantir que consultores não vejam dados extras",
              "Checar se há triggers concorrentes na mesma tabela",
              "Backup manual de tabelas sensíveis antes de migrações complexas"
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <div className="mt-1 h-3 w-3 rounded-full border border-warning shrink-0" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardHeader>
            <CardTitle className="text-md font-bold text-destructive">Plano de Rollback de Emergência</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Identificar ID da migration/commit causador do incidente",
              "Identificar se houve corrupção de dados (drift) ou apenas erro de UI",
              "Executar script de reversão de RPC se a lógica estiver quebrada",
              "Notificar administradores via canal de incidentes",
              "Em caso de drift financeiro, travar escritas temporariamente"
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <div className="mt-1 h-3 w-3 rounded-full border border-destructive shrink-0" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
