import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OperationalStatus = 
  | "operacional_nao_iniciado"
  | "aguardando_documentos"
  | "em_engenharia"
  | "engenharia_aprovada"
  | "instalacao_agendada"
  | "em_instalacao"
  | "instalacao_concluida"
  | "aguardando_homologacao"
  | "homologacao_aprovada"
  | "em_operacao"
  | "pedido_em_andamento"
  | "desconhecido";

export interface OperationalStatusInfo {
  status: OperationalStatus;
  label: string;
  colorClass: string;
}

const STATUS_CONFIG: Record<OperationalStatus, OperationalStatusInfo> = {
  em_operacao: { 
    status: "em_operacao", 
    label: "Usina em Operação", 
    colorClass: "bg-success/10 text-success border-success/20 font-bold" 
  },
  em_instalacao: { 
    status: "em_instalacao", 
    label: "Em Instalação", 
    colorClass: "bg-blue-500 text-white border-blue-600" 
  },
  instalacao_concluida: { 
    status: "instalacao_concluida", 
    label: "Instalação Concluída", 
    colorClass: "bg-emerald-100 text-emerald-700 border-emerald-200" 
  },
  instalacao_agendada: { 
    status: "instalacao_agendada", 
    label: "Instalação Agendada", 
    colorClass: "bg-indigo-100 text-indigo-700 border-indigo-200" 
  },
  aguardando_homologacao: { 
    status: "aguardando_homologacao", 
    label: "Aguardando Homologação", 
    colorClass: "bg-purple-100 text-purple-700 border-purple-200" 
  },
  homologacao_aprovada: { 
    status: "homologacao_aprovada", 
    label: "Homologação Aprovada", 
    colorClass: "bg-purple-500 text-white border-purple-600" 
  },
  em_engenharia: { 
    status: "em_engenharia", 
    label: "Em Engenharia", 
    colorClass: "bg-purple-100 text-purple-700 border-purple-200" 
  },
  engenharia_aprovada: { 
    status: "engenharia_aprovada", 
    label: "Engenharia Aprovada", 
    colorClass: "bg-blue-500 text-white border-blue-600" 
  },
  pedido_em_andamento: { 
    status: "pedido_em_andamento", 
    label: "Pedido em Andamento", 
    colorClass: "bg-amber-100 text-amber-700 border-amber-200" 
  },
  operacional_nao_iniciado: { 
    status: "operacional_nao_iniciado", 
    label: "Pronto para Engenharia", 
    colorClass: "bg-slate-100 text-slate-600 border-slate-200" 
  },
  aguardando_documentos: { 
    status: "aguardando_documentos", 
    label: "Aguardando Documentos", 
    colorClass: "bg-amber-100 text-amber-700 border-amber-200" 
  },
  desconhecido: { 
    status: "desconhecido", 
    label: "Status Pendente", 
    colorClass: "bg-muted text-muted-foreground border-border" 
  },
};

export function useOperationalStatus(dealId: string | null) {
  return useQuery({
    queryKey: ["operational-status", dealId],
    enabled: !!dealId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<OperationalStatusInfo> => {
      if (!dealId) return STATUS_CONFIG.desconhecido;

      // Single consolidated call (Anti-N+1)
      const { data, error } = await (supabase as any).rpc("get_project_operational_data", { _deal_id: dealId });
      
      if (error || !data) {
        console.error("Error fetching operational data:", error);
        return STATUS_CONFIG.desconhecido;
      }

      const { activation, vistoria, homologacao, checklists, os_instalacao, deal } = data;

      // 1. Em Operação (Highest Priority - Final state)
      if (activation?.data_ativacao) return STATUS_CONFIG.em_operacao;

      // 2. Homologação Aprovada (Requires proof from concessionaria)
      if (homologacao?.status === "aprovada") return STATUS_CONFIG.homologacao_aprovada;

      // 3. Aguardando Homologação (If installation finished or homologation in progress)
      const installationFinished = (os_instalacao || []).some((os: any) => os.status === "concluida");
      if (installationFinished || (homologacao?.status && homologacao.status !== "nao_solicitada")) {
        return STATUS_CONFIG.aguardando_homologacao;
      }

      // 4. Instalação Concluída (Derived from OS)
      if (installationFinished) return STATUS_CONFIG.instalacao_concluida;

      // 5. Em Instalação (Installation OS active)
      const installationInProgress = (os_instalacao || []).some((os: any) => os.status === "em_execucao");
      if (installationInProgress) return STATUS_CONFIG.em_instalacao;

      // 6. Instalação Agendada
      const installationScheduled = (os_instalacao || []).some((os: any) => os.status === "agendado");
      if (installationScheduled) return STATUS_CONFIG.instalacao_agendada;

      // 7. Engenharia Aprovada (Checklists finished but no OS yet)
      const engineeringFinished = (checklists || []).some((c: any) => c.status === "finalizado");
      if (engineeringFinished) return STATUS_CONFIG.engenharia_aprovada;

      // 8. Em Engenharia (Checklists started)
      if ((checklists || []).length > 0) return STATUS_CONFIG.em_engenharia;

      // 9. Aguardando Documentos (If deal is won but docs missing)
      // Agora usamos o campo docs_completos retornado pelo RPC consolidado
      const hasMissingDocs = deal?.docs_completos === false;
      
      if (deal?.status === "won" && hasMissingDocs) return STATUS_CONFIG.aguardando_documentos;

      // 10. Operacional não iniciado (If deal is won and docs are OK but no work yet)
      if (deal?.status === "won") return STATUS_CONFIG.operacional_nao_iniciado;

      return STATUS_CONFIG.desconhecido;
    }
  });
}
