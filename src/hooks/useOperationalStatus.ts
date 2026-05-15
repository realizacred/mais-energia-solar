import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OperationalStatus = 
  | "aguardando_documentos"
  | "engenharia"
  | "instalacao"
  | "homologacao"
  | "vistoria"
  | "em_operacao"
  | "desconhecido";

export interface OperationalStatusInfo {
  status: OperationalStatus;
  label: string;
  colorClass: string;
}

const STATUS_CONFIG: Record<OperationalStatus, OperationalStatusInfo> = {
  aguardando_documentos: { 
    status: "aguardando_documentos", 
    label: "Aguardando Documentos", 
    colorClass: "bg-amber-100 text-amber-700 border-amber-200" 
  },
  engenharia: { 
    status: "engenharia", 
    label: "Em Engenharia", 
    colorClass: "bg-blue-100 text-blue-700 border-blue-200" 
  },
  instalacao: { 
    status: "instalacao", 
    label: "Em Instalação", 
    colorClass: "bg-indigo-100 text-indigo-700 border-indigo-200" 
  },
  homologacao: { 
    status: "homologacao", 
    label: "Aguardando Homologação", 
    colorClass: "bg-purple-100 text-purple-700 border-purple-200" 
  },
  vistoria: { 
    status: "vistoria", 
    label: "Aguardando Vistoria", 
    colorClass: "bg-cyan-100 text-cyan-700 border-cyan-200" 
  },
  em_operacao: { 
    status: "em_operacao", 
    label: "Usina em Operação", 
    colorClass: "bg-success/10 text-success border-success/20" 
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

      // 1. Check Activation (Highest priority - Final Stage)
      const { data: activ } = await supabase
        .from("projeto_ativacao")
        .select("id, data_ativacao")
        .eq("projeto_id", dealId)
        .maybeSingle();
      
      if (activ?.data_ativacao) return STATUS_CONFIG.em_operacao;

      // 2. Check Vistoria/Medidor (Final operational stages)
      const { data: vistoria } = await supabase
        .from("projeto_vistoria")
        .select("status, resultado")
        .eq("projeto_id", dealId)
        .maybeSingle();

      if (vistoria?.status === "aprovada" || vistoria?.status === "agendada") return STATUS_CONFIG.vistoria;

      // 3. Check Homologação
      const { data: homolog } = await supabase
        .from("projeto_homologacao")
        .select("status")
        .eq("projeto_id", dealId)
        .maybeSingle();
      
      if (homolog?.status === "aprovada") {
        // Se homologado mas sem vistoria/ativação, ainda está em fluxo
        return STATUS_CONFIG.vistoria;
      }
      if (homolog?.status === "solicitada" || homolog?.status === "em_analise") return STATUS_CONFIG.homologacao;

      // 4. Check Installation (Checklists)
      const { data: checklists } = await supabase
        .from("checklists_instalador")
        .select("status")
        .eq("projeto_id", dealId)
        .neq("status", "cancelado");
      
      if (checklists && checklists.length > 0) {
        const hasFinished = checklists.some(c => c.status === "concluido" || c.status === "finalizado");
        if (!hasFinished) return STATUS_CONFIG.instalacao;
        // Se algum concluiu, mas não chegou na homologação/ativação, pode estar no limbo ou aguardando próximo passo
      }

      // 5. Check Proposta/Documentos
      const { data: dealData } = await supabase
        .from("deals")
        .select("doc_checklist")
        .eq("id", dealId)
        .single();
      
      const docChecklist = dealData?.doc_checklist as Record<string, any> | null;
      const DOC_KEYS = ["rg_cnh", "conta_luz", "iptu_imovel"]; // Basic docs
      const hasMissingDocs = docChecklist ? DOC_KEYS.some(k => !docChecklist[k]) : true;

      if (hasMissingDocs) return STATUS_CONFIG.aguardando_documentos;

      // 6. Fallback - Engenharia (Assumindo que pós-docs inicia engenharia)
      return STATUS_CONFIG.engenharia;
    }
  });
}
