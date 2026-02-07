import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
}

interface LeadStatusSelectorProps {
  leadId: string;
  currentStatusId: string | null;
  statuses: LeadStatus[];
  onStatusChange?: (newStatusId: string | null) => void;
}

export function LeadStatusSelector({
  leadId,
  currentStatusId,
  statuses,
  onStatusChange,
}: LeadStatusSelectorProps) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleStatusChange = async (value: string) => {
    const newStatusId = value === "novo" ? null : value;
    
    setSaving(true);
    try {
      const updateData: { status_id: string | null; ultimo_contato?: string } = {
        status_id: newStatusId,
      };

      // Update ultimo_contato when status changes
      if (newStatusId !== currentStatusId) {
        updateData.ultimo_contato = new Date().toISOString();
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", leadId);

      if (error) throw error;

      onStatusChange?.(newStatusId);
      
      const statusName = newStatusId 
        ? statuses.find(s => s.id === newStatusId)?.nome 
        : "Novo";
      
      toast({
        title: "Status atualizado!",
        description: `Lead movido para "${statusName}"`,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = statuses.find(s => s.id === currentStatusId);

  return (
    <div className="relative">
      <Select
        value={currentStatusId || "novo"}
        onValueChange={handleStatusChange}
        disabled={saving}
      >
        <SelectTrigger 
          className="w-[140px] h-8 text-xs"
          style={{
            borderColor: currentStatus?.cor || "#3b82f6",
            color: currentStatus?.cor || "#3b82f6",
          }}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <SelectValue placeholder="Status" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="novo">
            <span className="flex items-center gap-2">
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: "#3b82f6" }}
              />
              Novo
            </span>
          </SelectItem>
          {statuses.map((status) => (
            <SelectItem key={status.id} value={status.id}>
              <span className="flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: status.cor }}
                />
                {status.nome}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
