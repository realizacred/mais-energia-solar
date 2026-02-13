import { useCallback } from "react";
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
  google_event_id: string | null;
  google_sync_status: string;
  google_sync_error: string | null;
  google_synced_at: string | null;
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
 * Hook for managing appointments with internal DB as source of truth
 * and optional Google Calendar sync (based on tenant config).
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

  // Get tenant agenda config
  const { data: agendaConfig } = useQuery({
    queryKey: ["agenda_config"],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_config" as any)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as {
        agenda_enabled: boolean;
        google_sync_enabled: boolean;
        google_sync_mode: string;
        google_sync_types: string[];
      } | null;
    },
  });

  const syncToGoogle = useCallback(
    async (appointment: Appointment, action: "create" | "update" | "delete") => {
      if (!agendaConfig?.google_sync_enabled) return;

      // Check if this appointment type should be synced
      const syncTypes = agendaConfig.google_sync_types || ["call", "meeting"];
      if (action !== "delete" && !syncTypes.includes(appointment.appointment_type)) return;

      try {
        const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
          body: {
            action,
            event_type: "appointment",
            record_id: appointment.id,
            user_id: appointment.assigned_to || user?.id,
            event_data:
              action === "delete"
                ? undefined
                : {
                    summary: appointment.title,
                    description: appointment.description || "",
                    start: appointment.starts_at,
                    end: appointment.ends_at || new Date(new Date(appointment.starts_at).getTime() + 60 * 60 * 1000).toISOString(),
                  },
          },
        });

        if (error || data?.error) {
          // Log sync failure
          await supabase.from("agenda_sync_logs" as any).insert({
            appointment_id: appointment.id,
            action,
            status: "error",
            error_message: error?.message || data?.error || "Unknown error",
          });

          // Update appointment sync status
          await supabase
            .from("appointments" as any)
            .update({
              google_sync_status: "failed",
              google_sync_error: error?.message || data?.error,
            })
            .eq("id", appointment.id);

          return;
        }

        if (data?.skipped) return;

        // Success
        await supabase
          .from("appointments" as any)
          .update({
            google_event_id: data?.event_id || null,
            google_sync_status: "synced",
            google_sync_error: null,
            google_synced_at: new Date().toISOString(),
          })
          .eq("id", appointment.id);

        await supabase.from("agenda_sync_logs" as any).insert({
          appointment_id: appointment.id,
          action,
          status: "success",
          google_event_id: data?.event_id,
        });
      } catch (err: any) {
        console.warn("Google sync failed silently:", err);
        await supabase
          .from("appointments" as any)
          .update({
            google_sync_status: "failed",
            google_sync_error: err?.message || "Network error",
          })
          .eq("id", appointment.id);
      }
    },
    [agendaConfig, user?.id]
  );

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
    onSuccess: async (appointment) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Compromisso agendado ✅" });

      // Fire-and-forget Google sync
      syncToGoogle(appointment, "create");
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
    onSuccess: async (appointment) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      syncToGoogle(appointment, "update");
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
    onSuccess: async (appointment) => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Compromisso cancelado" });

      if (appointment.google_event_id) {
        syncToGoogle(appointment, "delete");
      }
    },
  });

  return {
    appointments,
    isLoading,
    agendaConfig,
    createAppointment: createMutation.mutate,
    updateAppointment: updateMutation.mutate,
    cancelAppointment: cancelMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
