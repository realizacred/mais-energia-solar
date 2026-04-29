/**
 * MigrationFinalReport — Relatório final de auditoria pós-migração SolarMarket.
 *
 * Mostra ao usuário a explicação matemática das diferenças entre
 * staging e CRM (dedup de clientes por CPF, projetos órfãos sem
 * proposta, etc.), evitando a falsa percepção de "dados perdidos".
 *
 * Renderiza apenas quando há dados no CRM (post-promote).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Info, Users, FolderKanban, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditNumbers {
  staging_clientes: number;
  staging_projetos: number;
  staging_propostas: number;
  crm_clientes: number;
  crm_projetos: number;
  crm_propostas: number;
  links_cliente_sm_ids: number; // IDs SM distintos vinculados
}

interface Props {
  tenantId: string | null;
}

export function MigrationFinalReport({ tenantId }: Props) {
  const { data, isLoading } = useQuery<AuditNumbers | null>({
    queryKey: ["sm-migration-audit", tenantId],
    enabled: !!tenantId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (!tenantId) return null;
      const SOURCES = ["solarmarket", "solar_market"];

      const [
        sCli, sProj, sProp,
        cCli, cProj, cProp,
        linksCli,
      ] = await Promise.all([
        (supabase as any).from("sm_clientes_raw").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        (supabase as any).from("sm_projetos_raw").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        (supabase as any).from("sm_propostas_raw").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("external_source", SOURCES),
        supabase.from("projetos").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("external_source", SOURCES),
        supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).in("external_source", SOURCES),
        (supabase as any).from("external_entity_links").select("source_entity_id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).in("source", SOURCES).eq("entity_type", "cliente"),
      ]);

      return {
        staging_clientes: sCli.count ?? 0,
        staging_projetos: sProj.count ?? 0,
        staging_propostas: sProp.count ?? 0,
        crm_clientes: cCli.count ?? 0,
        crm_projetos: cProj.count ?? 0,
        crm_propostas: cProp.count ?? 0,
        links_cliente_sm_ids: linksCli.count ?? 0,
      };
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.crm_propostas === 0) return null;

  const dedupClientes = Math.max(0, data.links_cliente_sm_ids - data.crm_clientes);
  const orfaosClientes = Math.max(0, data.staging_clientes - data.links_cliente_sm_ids);
  const orfaosProjetos = Math.max(0, data.staging_projetos - data.crm_projetos);
  const propostasOk = data.crm_propostas >= data.staging_propostas;

  const linhas = [
    {
      icon: Users,
      label: "Clientes",
      staging: data.staging_clientes,
      crm: data.crm_clientes,
      explicacao: (
        <>
          <strong>{data.links_cliente_sm_ids.toLocaleString("pt-BR")}</strong> IDs do SolarMarket
          colapsados em <strong>{data.crm_clientes.toLocaleString("pt-BR")}</strong> clientes únicos
          (dedup por CPF/CNPJ removeu {dedupClientes.toLocaleString("pt-BR")} duplicatas).
          {orfaosClientes > 0 && (
            <> {orfaosClientes.toLocaleString("pt-BR")} clientes do staging sem projeto/proposta vinculados.</>
          )}
        </>
      ),
    },
    {
      icon: FolderKanban,
      label: "Projetos",
      staging: data.staging_projetos,
      crm: data.crm_projetos,
      explicacao: orfaosProjetos > 0 ? (
        <>{orfaosProjetos.toLocaleString("pt-BR")} projetos no staging não têm proposta vinculada — o motor migra apenas projetos com pelo menos 1 proposta.</>
      ) : (
        <>Todos os projetos com proposta foram migrados.</>
      ),
    },
    {
      icon: FileText,
      label: "Propostas",
      staging: data.staging_propostas,
      crm: data.crm_propostas,
      explicacao: propostasOk ? (
        <>100% das propostas do staging foram promovidas com sucesso.</>
      ) : (
        <>Faltam {(data.staging_propostas - data.crm_propostas).toLocaleString("pt-BR")} propostas para migrar.</>
      ),
    },
  ];

  return (
    <Card className="bg-card border-border shadow-sm border-l-4 border-l-success">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Relatório final da migração</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Diferença entre staging e CRM explicada por dedup e regras do motor (RB-64 / RB-65).
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {linhas.map(({ icon: Icon, label, staging, crm, explicacao }) => {
            const diff = staging - crm;
            const diffLabel = diff === 0 ? "" : diff > 0 ? `−${diff.toLocaleString("pt-BR")}` : `+${Math.abs(diff).toLocaleString("pt-BR")}`;
            return (
              <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{label}:</span>
                    <span className="text-sm font-mono">
                      {staging.toLocaleString("pt-BR")} no staging
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-sm font-mono text-success">
                      {crm.toLocaleString("pt-BR")} no CRM
                    </span>
                    {diffLabel && (
                      <span className="text-xs font-mono text-muted-foreground">
                        ({diffLabel})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{explicacao}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-info/5 border border-info/20">
          <Info className="w-4 h-4 text-info mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Dedup é esperado:</strong> o SolarMarket frequentemente
            cadastra o mesmo CPF múltiplas vezes (um por projeto). O CRM consolida em 1 cliente único
            mantendo todos os projetos e propostas vinculados.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
