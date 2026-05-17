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

      const { activation, homologacao, os_instalacao, deal, memberships } = data;

      const funnelMemberships = memberships || [];

      // 1. Funil "Sistema em Operação" concluído ou ativação registrada?
      // (Highest Priority - Final state)
      const activationPipeline = funnelMemberships.find((m: any) => 
        m.pipeline_name.toLowerCase().includes("operação") || 
        m.pipeline_name.toLowerCase().includes("ativação")
      );
      if (activation?.data_ativacao || (activationPipeline && activationPipeline.stage_name.toLowerCase().includes("concluído"))) {
        return STATUS_CONFIG.em_operacao;
      }

      // 2. Homologação Aprovada
      if (homologacao?.status === "aprovada") return STATUS_CONFIG.homologacao_aprovada;

      // 3. Funil "Instalação" em andamento?
      const instalacaoPipeline = funnelMemberships.find((m: any) => 
        m.pipeline_name.toLowerCase().includes("instalação")
      );
      const installationInProgress = (os_instalacao || []).some((os: any) => os.status === "em_execucao");
      const installationScheduled = (os_instalacao || []).some((os: any) => os.status === "agendado");
      const installationFinished = (os_instalacao || []).some((os: any) => os.status === "concluida");

      if (instalacaoPipeline || installationInProgress || installationScheduled || installationFinished) {
        if (installationFinished) return STATUS_CONFIG.instalacao_concluida;
        if (installationInProgress) return STATUS_CONFIG.em_instalacao;
        if (installationScheduled) return STATUS_CONFIG.instalacao_agendada;
        return STATUS_CONFIG.em_instalacao; // Fallback if pipeline exists but no OS status
      }

      // 4. Aguardando Homologação (se instalação terminou ou homologação iniciou)
      if (installationFinished || (homologacao?.status && homologacao.status !== "nao_solicitada")) {
        return STATUS_CONFIG.aguardando_homologacao;
      }

      // 5. Funil "Engenharia" em andamento?
      const engenhariaPipeline = funnelMemberships.find((m: any) => 
        m.pipeline_name.toLowerCase().includes("engenharia")
      );
      if (engenhariaPipeline) {
        if (engenhariaPipeline.stage_name.toLowerCase().includes("aprovado")) {
          return STATUS_CONFIG.engenharia_aprovada;
        }
        return STATUS_CONFIG.em_engenharia;
      }

      // 6. Funil "Equipamento" em andamento?
      const equipamentoPipeline = funnelMemberships.find((m: any) => 
        m.pipeline_name.toLowerCase().includes("equipamento") || 
        m.pipeline_name.toLowerCase().includes("suprimentos") ||
        m.pipeline_name.toLowerCase().includes("pedido")
      );
      if (equipamentoPipeline) {
        return STATUS_CONFIG.pedido_em_andamento;
      }

      // 7. Deal ganho + nenhum funil iniciado?
      if (deal?.status === "won") {
        // 8. Docs faltando?
        const hasMissingDocs = deal?.docs_completos === false;
        if (hasMissingDocs) return STATUS_CONFIG.aguardando_documentos;

        return STATUS_CONFIG.operacional_nao_iniciado;
      }

      return STATUS_CONFIG.desconhecido;
    }
  });
}
