import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function useReopenLead(onSuccess?: () => void) {
  const [reopening, setReopening] = useState(false);
  const { toast } = useToast();

  const reopenLead = async (leadId: string, clienteId?: string | null) => {
    setReopening(true);
    try {
      // Find "Negociação" status
      const { data: negociacaoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Negociação")
        .single();

      if (!negociacaoStatus) {
        toast({ title: "Status 'Negociação' não encontrado", variant: "destructive" });
        return false;
      }

      // Reset lead status back to Negociação
      await supabase
        .from("leads")
        .update({ status_id: negociacaoStatus.id, updated_at: new Date().toISOString() })
        .eq("id", leadId);

      // Also reset orcamentos status
      await supabase
        .from("orcamentos")
        .update({ status_id: negociacaoStatus.id, updated_at: new Date().toISOString() })
        .eq("lead_id", leadId);

      // Deactivate or delete client if exists
      if (clienteId) {
        const depChecks = await Promise.all([
          supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
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

      toast({ title: "Lead reaberto com sucesso", description: "O lead voltou para o status 'Negociação'." });
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
