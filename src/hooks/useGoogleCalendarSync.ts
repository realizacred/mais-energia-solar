import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CalendarEventData {
  summary: string;
  description?: string;
  start: string; // ISO datetime
  end?: string;  // ISO datetime
  location?: string;
}

/**
 * Hook to sync events with Google Calendar.
 * Silently skips if user has no connected calendar.
 */
export function useGoogleCalendarSync() {
  const { toast } = useToast();

  const syncEvent = useCallback(
    async (params: {
      action: "create" | "update" | "delete";
      event_type: "servico" | "followup";
      record_id: string;
      event_data?: CalendarEventData;
      user_id?: string;
    }) => {
      try {
        const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
          body: params,
        });

        if (error) {
          console.warn("Calendar sync error:", error);
          return null;
        }

        // If user has no calendar connected, silently skip
        if (data?.skipped) return null;

        if (data?.error) {
          console.warn("Calendar sync:", data.error);
          return null;
        }

        return data;
      } catch (err) {
        console.warn("Calendar sync failed:", err);
        return null;
      }
    },
    []
  );

  const syncServico = useCallback(
    async (
      action: "create" | "update" | "delete",
      recordId: string,
      servico?: {
        tipo: string;
        data_agendada: string;
        hora_inicio?: string | null;
        endereco?: string | null;
        bairro?: string | null;
        cidade?: string | null;
        cliente_nome?: string;
        instalador_id?: string;
      },
      userId?: string
    ) => {
      if (action === "delete") {
        return syncEvent({
          action: "delete",
          event_type: "servico",
          record_id: recordId,
          user_id: userId,
        });
      }

      if (!servico) return null;

      const tipoLabels: Record<string, string> = {
        instalacao: "Instalação Solar",
        manutencao: "Manutenção",
        visita_tecnica: "Visita Técnica",
        suporte: "Suporte",
      };

      const startDate = servico.hora_inicio
        ? `${servico.data_agendada}T${servico.hora_inicio}`
        : `${servico.data_agendada}T09:00:00`;

      const start = new Date(startDate + "-03:00").toISOString();
      const end = new Date(new Date(start).getTime() + 2 * 60 * 60 * 1000).toISOString();

      const locationParts = [servico.endereco, servico.bairro, servico.cidade].filter(Boolean);

      return syncEvent({
        action,
        event_type: "servico",
        record_id: recordId,
        user_id: userId,
        event_data: {
          summary: `${tipoLabels[servico.tipo] || servico.tipo}${servico.cliente_nome ? ` - ${servico.cliente_nome}` : ""}`,
          description: `Serviço agendado via CRM\nTipo: ${tipoLabels[servico.tipo] || servico.tipo}`,
          start,
          end,
          location: locationParts.join(", "),
        },
      });
    },
    [syncEvent]
  );

  return { syncEvent, syncServico };
}
