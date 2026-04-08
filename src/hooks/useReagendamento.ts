import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface Reagendamento {
  id: string;
  appointment_id: string;
  data_anterior: string;
  nova_data: string;
  motivo: string;
  alterado_por: string | null;
  notificou_wa: boolean;
  created_at: string;
}

export interface ReagendarInput {
  appointment_id: string;
  nova_data: string; // ISO datetime
  motivo: string;
  notificar_wa: boolean;
}

export function useReagendamentos(appointmentId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["appointment_reagendamentos", appointmentId];

  const { data: reagendamentos = [], isLoading } = useQuery({
    queryKey,
    enabled: !!appointmentId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_reagendamentos" as any)
        .select("id, appointment_id, data_anterior, nova_data, motivo, alterado_por, notificou_wa, created_at")
        .eq("appointment_id", appointmentId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Reagendamento[];
    },
  });

  const reagendarMutation = useMutation({
    mutationFn: async (input: ReagendarInput) => {
      // 1. Buscar appointment atual para pegar data anterior
      const { data: appointment, error: fetchErr } = await supabase
        .from("appointments" as any)
        .select("starts_at")
        .eq("id", input.appointment_id)
        .single();

      if (fetchErr || !appointment) throw new Error("Agendamento não encontrado");

      const dataAnterior = (appointment as any).starts_at;

      // 2. Inserir registro de reagendamento
      const { error: insertErr } = await supabase
        .from("appointment_reagendamentos" as any)
        .insert({
          appointment_id: input.appointment_id,
          data_anterior: dataAnterior,
          nova_data: input.nova_data,
          motivo: input.motivo,
          alterado_por: user?.id,
          notificou_wa: input.notificar_wa,
        });

      if (insertErr) throw insertErr;

      // 3. Atualizar o appointment com nova data
      const { data: updated, error: updateErr } = await supabase
        .from("appointments" as any)
        .update({ starts_at: input.nova_data })
        .eq("id", input.appointment_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // 4. RB-25: fire-and-forget WA notification
      if (input.notificar_wa) {
        supabase.functions.invoke("notificar-agendamento-wa", {
          body: {
            appointment_id: input.appointment_id,
            is_reagendamento: true,
            motivo: input.motivo,
          },
        }).catch(() => {});
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment_reagendamentos"] });
      toast({ title: "Instalação reagendada ✅" });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao reagendar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return {
    reagendamentos,
    isLoading,
    reagendar: reagendarMutation.mutate,
    isReagendando: reagendarMutation.isPending,
  };
}
