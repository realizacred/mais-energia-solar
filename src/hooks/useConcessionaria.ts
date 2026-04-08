import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type VistoriaStatus = "nao_solicitada" | "solicitada" | "agendada" | "aprovada" | "reprovada";

export interface VistoriaData {
  id?: string;
  status: VistoriaStatus;
  protocolo?: string | null;
  data_solicitacao?: string | null;
  data_agendada?: string | null;
  data_realizada?: string | null;
  resultado?: string | null;
  motivo_reprovacao?: string | null;
  observacoes?: string | null;
}

export interface MedidorData {
  id?: string;
  numero_medidor_antigo?: string | null;
  numero_medidor_novo?: string | null;
  data_troca?: string | null;
  tipo?: string;
  observacoes?: string | null;
}

export interface AtivacaoData {
  id?: string;
  data_ativacao?: string | null;
  numero_uc?: string | null;
  confirmado_por?: string | null;
  observacoes?: string | null;
}

const keys = {
  vistoria: (pid: string) => ["projeto_vistoria", pid] as const,
  medidor: (pid: string) => ["projeto_medidor", pid] as const,
  ativacao: (pid: string) => ["projeto_ativacao", pid] as const,
};

export function useConcessionaria(projetoId: string) {
  const qc = useQueryClient();

  // ── Vistoria ──
  const vistoriaQuery = useQuery({
    queryKey: keys.vistoria(projetoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_vistoria")
        .select("*")
        .eq("projeto_id", projetoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!projetoId,
  });

  const salvarVistoriaMut = useMutation({
    mutationFn: async (dados: Partial<VistoriaData>) => {
      const existing = vistoriaQuery.data;
      if (existing?.id) {
        const { error } = await supabase
          .from("projeto_vistoria")
          .update({ ...dados, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projeto_vistoria")
          .insert({ projeto_id: projetoId, ...dados } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.vistoria(projetoId) });
      toast({ title: "Vistoria salva com sucesso" });
    },
    onError: (e: any) => {
      console.error("[useConcessionaria] Erro ao salvar vistoria:", e);
      toast({ title: "Erro ao salvar vistoria", description: e.message, variant: "destructive" });
    },
  });

  const avancarVistoriaMut = useMutation({
    mutationFn: async ({ novoStatus, extras }: { novoStatus: VistoriaStatus; extras?: Partial<VistoriaData> }) => {
      const existing = vistoriaQuery.data;
      const payload: any = { status: novoStatus, ...extras, updated_at: new Date().toISOString() };
      if (existing?.id) {
        const { error } = await supabase
          .from("projeto_vistoria")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projeto_vistoria")
          .insert({ projeto_id: projetoId, ...payload } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.vistoria(projetoId) });
      toast({ title: "Status da vistoria atualizado" });
    },
    onError: (e: any) => {
      console.error("[useConcessionaria] Erro ao avançar vistoria:", e);
      toast({ title: "Erro ao atualizar vistoria", description: e.message, variant: "destructive" });
    },
  });

  // ── Medidor ──
  const medidorQuery = useQuery({
    queryKey: keys.medidor(projetoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_medidor")
        .select("*")
        .eq("projeto_id", projetoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!projetoId,
  });

  const salvarMedidorMut = useMutation({
    mutationFn: async (dados: Partial<MedidorData>) => {
      const existing = medidorQuery.data;
      if (existing?.id) {
        const { error } = await supabase
          .from("projeto_medidor")
          .update({ ...dados, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projeto_medidor")
          .insert({ projeto_id: projetoId, ...dados } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.medidor(projetoId) });
      toast({ title: "Medidor salvo com sucesso" });
    },
    onError: (e: any) => {
      console.error("[useConcessionaria] Erro ao salvar medidor:", e);
      toast({ title: "Erro ao salvar medidor", description: e.message, variant: "destructive" });
    },
  });

  // ── Ativação ──
  const ativacaoQuery = useQuery({
    queryKey: keys.ativacao(projetoId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_ativacao")
        .select("*")
        .eq("projeto_id", projetoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!projetoId,
  });

  const salvarAtivacaoMut = useMutation({
    mutationFn: async (dados: Partial<AtivacaoData>) => {
      const existing = ativacaoQuery.data;
      if (existing?.id) {
        const { error } = await supabase
          .from("projeto_ativacao")
          .update({ ...dados, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projeto_ativacao")
          .insert({ projeto_id: projetoId, ...dados } as any);
        if (error) throw error;
      }
      // Mark project as won
      const { error: dealErr } = await supabase
        .from("deals")
        .update({ status: "won" })
        .eq("id", projetoId);
      if (dealErr) {
        console.error("[useConcessionaria] Erro ao marcar projeto como concluído:", dealErr);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.ativacao(projetoId) });
      qc.invalidateQueries({ queryKey: ["projeto-detalhe"] });
      toast({ title: "Ativação confirmada! Sistema ativo." });
    },
    onError: (e: any) => {
      console.error("[useConcessionaria] Erro ao salvar ativação:", e);
      toast({ title: "Erro ao confirmar ativação", description: e.message, variant: "destructive" });
    },
  });

  return {
    vistoria: vistoriaQuery.data,
    vistoriaLoading: vistoriaQuery.isLoading,
    salvarVistoria: salvarVistoriaMut.mutateAsync,
    avancarVistoria: (novoStatus: VistoriaStatus, extras?: Partial<VistoriaData>) =>
      avancarVistoriaMut.mutateAsync({ novoStatus, extras }),
    vistoriaSaving: salvarVistoriaMut.isPending || avancarVistoriaMut.isPending,

    medidor: medidorQuery.data,
    medidorLoading: medidorQuery.isLoading,
    salvarMedidor: salvarMedidorMut.mutateAsync,
    medidorSaving: salvarMedidorMut.isPending,

    ativacao: ativacaoQuery.data,
    ativacaoLoading: ativacaoQuery.isLoading,
    salvarAtivacao: salvarAtivacaoMut.mutateAsync,
    ativacaoSaving: salvarAtivacaoMut.isPending,
  };
}
