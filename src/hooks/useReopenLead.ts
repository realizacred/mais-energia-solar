import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLeadStatusMap } from "@/hooks/useLeadStatusMap";

export function useReopenLead(onSuccess?: () => void) {
  const [reopening, setReopening] = useState(false);
  const { toast } = useToast();
  const { reopenTarget, statuses } = useLeadStatusMap();

  const reopenLead = async (leadId: string, clienteId?: string | null) => {
    setReopening(true);
    try {
      if (!reopenTarget) {
        console.error("[useReopenLead] No reopen target status found. Available:", statuses);
        toast({ title: "Status de reabertura não encontrado", variant: "destructive" });
        return false;
      }

      // console.debug(`[useReopenLead] Reopening lead ${leadId} to status "${reopenTarget.nome}" (id=${reopenTarget.id})`);

      // Reset lead status
      await supabase
        .from("leads")
        .update({ status_id: reopenTarget.id, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      // Also reset orcamentos status
      await supabase
        .from("orcamentos")
        .update({ status_id: reopenTarget.id, updated_at: new Date().toISOString() })
        .eq("lead_id", leadId);

      // Deactivate or delete client if exists
      if (clienteId) {
        const depChecks = await Promise.all([
          supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId).neq("status", "excluida"),
          supabase.from("projetos").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
          supabase.from("deals").select("id", { count: "exact", head: true }).eq("customer_id", clienteId),
        ]);
        const hasRelations = depChecks.some((res) => (res.count ?? 0) > 0);

        if (hasRelations) {
          await supabase.from("clientes").update({ ativo: false }).eq("id", clienteId);
        } else {
          await supabase.from("clientes").delete().eq("id", clienteId);
        }
      }

      toast({ title: "Lead reaberto com sucesso", description: `O lead voltou para "${reopenTarget.nome}".` });
      onSuccess?.();
      return true;
    } catch (error) {
      console.error("Erro ao reabrir lead:", error);
      toast({ title: "Erro ao reabrir lead", variant: "destructive" });
      return false;
    } finally {
      setReopening(false);
    }
  };

  return { reopenLead, reopening };
}
