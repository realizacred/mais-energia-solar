import { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssignVendorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamentoId: string;
  leadId: string;
  /** @deprecated Display-only — use vendedor_nome or currentVendedorId */
  currentVendedor?: string | null;
  currentVendedorId?: string | null;
  currentVendedorNome?: string | null;
  clienteNome: string;
  onSuccess?: () => void;
}

export function AssignVendorDialog({
  open,
  onOpenChange,
  orcamentoId,
  leadId,
  currentVendedor,
  currentVendedorId,
  currentVendedorNome,
  clienteNome,
  onSuccess,
}: AssignVendorDialogProps) {
  const { data: consultores = [], isLoading: loading } = useConsultoresAtivos();
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const displayName = currentVendedorNome || currentVendedor || null;

  useEffect(() => {
    if (open) {
      setSelectedVendedorId(currentVendedorId || "");
    }
  }, [open, currentVendedorId]);

  const handleAssign = async () => {
    if (!selectedVendedorId) {
      toast({
        title: "Selecione um consultor",
        description: "Escolha um consultor para atribuir este orçamento.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const vendedorObj = consultores.find(v => v.id === selectedVendedorId);
      const vendedorNome = vendedorObj?.nome || "";

      const { error: orcError } = await supabase
        .from("orcamentos")
        .update({ consultor: vendedorNome })
        .eq("id", orcamentoId);

      if (orcError) throw orcError;

      const { error: leadError } = await supabase
        .from("leads")
        .update({
          consultor_id: selectedVendedorId,
          consultor: vendedorNome,
          distribuido_em: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (leadError) throw leadError;

      toast({
        title: "Consultor atribuído!",
        description: `Orçamento transferido para ${vendedorNome}.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error assigning vendedor:", error);
      toast({
        title: "Erro ao atribuir",
        description: "Não foi possível atribuir o consultor. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveVendor = async () => {
    setSaving(true);
    try {
      const { data: leadData } = await supabase
        .from("leads")
        .select("tenant_id")
        .eq("id", leadId)
        .single();

      const { data: defaultVendedor, error: resolveError } = await supabase
        .rpc("resolve_default_consultor_id", { _tenant_id: leadData?.tenant_id });

      if (resolveError || !defaultVendedor) {
        throw new Error("Não foi possível resolver consultor padrão da fila");
      }

      const { data: vendedorData } = await supabase
        .from("consultores" as any)
        .select("nome")
        .eq("id", defaultVendedor)
        .single();

      const { error: orcError } = await supabase
        .from("orcamentos")
        .update({ consultor: (vendedorData as any)?.nome || null })
        .eq("id", orcamentoId);

      if (orcError) throw orcError;

      const { error: leadError } = await supabase
        .from("leads")
        .update({ consultor: (vendedorData as any)?.nome || null, consultor_id: defaultVendedor })
        .eq("id", leadId);

      if (leadError) throw leadError;

      toast({
        title: "Devolvido à fila",
        description: "O lead foi reatribuído ao consultor padrão.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error returning to queue:", error);
      toast({
        title: "Erro",
        description: "Não foi possível devolver à fila.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Atribuir Consultor
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transfira o orçamento de <strong>{clienteNome}</strong> para um consultor
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
          {displayName && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Consultor atual:</span>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {displayName}
              </Badge>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo consultor</label>
              <Select value={selectedVendedorId} onValueChange={setSelectedVendedorId}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Selecione um consultor..." />
                </SelectTrigger>
                <SelectContent>
                  {consultores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          {displayName ? (
            <Button
              variant="outline"
              onClick={handleRemoveVendor}
              disabled={saving}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              Remover Consultor
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={saving || !selectedVendedorId}>
              {saving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Atribuir
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
