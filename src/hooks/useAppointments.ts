import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export type AppointmentType = "call" | "meeting" | "followup" | "visit" | "other";
export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "missed";

export interface Appointment {
  id: string;
  tenant_id: string;
  created_by: string | null;
  assigned_to: string | null;
  conversation_id: string | null;
  lead_id: string | null;
  cliente_id: string | null;
  title: string;
  description: string | null;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  reminder_minutes: number;
  reminder_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentInput {
  title: string;
  description?: string;
  appointment_type: AppointmentType;
  starts_at: string;
  ends_at?: string;
  all_day?: boolean;
  reminder_minutes?: number;
  assigned_to?: string;
  conversation_id?: string;
  lead_id?: string;
  cliente_id?: string;
}

/**
 * Hook for managing appointments (internal DB only).
 */
export function useAppointments(filters?: {
  conversation_id?: string;
  assigned_to?: string;
  status?: AppointmentStatus;
  from?: string;
  to?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["appointments", filters];

  const { data: appointments = [], isLoading } = useQuery({
    queryKey,
    enabled: !!user?.id,
    queryFn: async () => {
      let query = supabase
        .from("appointments" as any)
        .select("*")
        .order("starts_at", { ascending: true });

      if (filters?.conversation_id) {
        query = query.eq("conversation_id", filters.conversation_id);
      }
      if (filters?.assigned_to) {
        query = query.eq("assigned_to", filters.assigned_to);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.from) {
        query = query.gte("starts_at", filters.from);
      }
      if (filters?.to) {
        query = query.lte("starts_at", filters.to);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Appointment[];
    },
  });

  // ⚠️ HARDENING: Realtime subscription for cross-user sync on appointments
  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["appointments"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const { data, error } = await supabase
        .from("appointments" as any)
        .insert({
          ...input,
          created_by: user?.id,
          assigned_to: input.assigned_to || user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Compromisso agendado ✅" });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao agendar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Appointment> & { id: string }) => {
      const { data, error } = await supabase
        .from("appointments" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("appointments" as any)
        .update({ status: "cancelled" })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Appointment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Compromisso cancelado" });
    },
  });

  return {
    appointments,
    isLoading,
    createAppointment: createMutation.mutate,
    updateAppointment: updateMutation.mutate,
    cancelAppointment: cancelMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
