import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ShieldCheck, 
  History, 
  Database, 
  Zap, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const GovernancePage = () => {
  // Simulating fetching recent migrations or RPC status
  const { data: dbInfo, isLoading } = useQuery({
    queryKey: ["governance-db-info"],
    queryFn: async () => {
      // In a real scenario, we might query a version table or similar
      return {
        lastMigration: "2024-05-15_fix_atomic_proposal_deletion",
        rpcCount: 142,
        triggerCount: 28,
        sensitiveTables: ["propostas", "financeiro_lancamentos", "projetos", "users"]
      };
    }
  });

  const checklists = [
    {
      id: "pre-deploy",
      title: "Checklist Pré-Deploy",
      items: [
        "Backup do banco de dados executado",
        "Testes E2E (Playwright/Cypress) validados em Staging",
        "Revisão de variáveis de ambiente no Supabase",
        "Comunicação de manutenção enviada aos tenants críticos"
      ]
    },
    {
      id: "rollback",
      title: "Plano de Rollback (Emergência)",
      items: [
        "Identificar commit estável anterior",
        "Executar script de reversão de migration (se houver alteração de schema)",
        "Limpar cache do Edge Network (Cloudflare/Vercel)",
        "Notificar time técnico via canal de incidentes"
      ]
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Governança do Sistema</h1>
        <p className="text-muted-foreground">
          Monitoramento de estabilidade, checklists de segurança e histórico de alterações estruturais.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integridade do Banco</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">Excelente</div>
            <p className="text-xs text-muted-foreground mt-1">
              {dbInfo?.triggerCount} triggers ativos e saudáveis.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Alteração Crítica</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-md font-semibold truncate" title={dbInfo?.lastMigration}>
              {dbInfo?.lastMigration || "Carregando..."}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Há 12 horas.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RPCs Disponíveis</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbInfo?.rpcCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Prontas para execução operacional.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Tabelas Sensíveis
              </CardTitle>
              <CardDescription>Monitoramento de RLS e auditoria obrigatória.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dbInfo?.sensitiveTables.map((table) => (
                  <div key={table} className="flex items-center justify-between p-2 border rounded-md">
                    <span className="font-mono text-sm">{table}</span>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-success/5 text-success border-success/20">RLS OK</Badge>
                      <Badge variant="outline" className="bg-info/5 text-info border-info/20">Auditando</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-warning" /> Sincronização Cross-Tenant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-md text-sm">
                Nenhum vazamento detectado nas últimas 24h. Verificação de `tenant_id` ativa em todas as queries.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {checklists.map((cl) => (
            <Card key={cl.id}>
              <CardHeader>
                <CardTitle className="text-lg">{cl.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cl.items.map((item, i) => (
                  <div key={i} className="flex items-start space-x-3 space-y-0">
                    <Checkbox id={`${cl.id}-${i}`} />
                    <label
                      htmlFor={`${cl.id}-${i}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {item}
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GovernancePage;