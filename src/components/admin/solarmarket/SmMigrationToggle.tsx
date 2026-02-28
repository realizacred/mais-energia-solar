import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, X } from "lucide-react";
import type { SmProposal } from "@/hooks/useSolarMarket";

interface Props {
  proposal: SmProposal;
}

export function SmMigrationToggle({ proposal }: Props) {
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const newValue = !proposal.migrar_para_canonico;
      const { data: { user } } = await supabase.auth.getUser();

      const update: Record<string, any> = {
        migrar_para_canonico: newValue,
        migrar_requested_at: newValue ? new Date().toISOString() : null,
        migrar_requested_by: newValue ? user?.id ?? null : null,
      };

      const { error } = await (supabase as any)
        .from("solar_market_proposals")
        .update(update)
        .eq("id", proposal.id);

      if (error) throw error;
      toast.success(newValue ? "Marcada para migração" : "Desmarcada");
      qc.invalidateQueries({ queryKey: ["sm-proposals"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao atualizar");
    } finally {
      setLoading(false);
    }
  };

  if (proposal.migrar_para_canonico) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Badge className="text-[10px] bg-primary/10 text-primary">Marcada</Badge>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={toggle} disabled={loading}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={toggle} disabled={loading}>
      <ArrowRightLeft className="h-3 w-3 mr-1" /> Migrar
    </Button>
  );
}
