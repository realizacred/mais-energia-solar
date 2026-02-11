import { useState, useEffect } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Vendedor {
  id: string;
  nome: string;
  codigo: string | null;
  ativo: boolean;
}

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
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const displayName = currentVendedorNome || currentVendedor || null;

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    supabase
      .from("vendedores")
      .select("id, nome, codigo, ativo")
      .eq("ativo", true)
      .order("nome")
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching vendedores:", error);
        } else {
          setVendedores(data || []);
        }
        setLoading(false);
      });

    // Pre-select current vendedor by ID
    setSelectedVendedorId(currentVendedorId || "");
  }, [open, currentVendedorId]);

  const handleAssign = async () => {
    if (!selectedVendedorId) {
      toast({
        title: "Selecione um vendedor",
        description: "Escolha um vendedor para atribuir este orçamento.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const vendedorObj = vendedores.find(v => v.id === selectedVendedorId);
      const vendedorNome = vendedorObj?.nome || "";

      // Update the orcamento's vendedor (text) for backward compat
      const { error: orcError } = await supabase
        .from("orcamentos")
        .update({ vendedor: vendedorNome })
        .eq("id", orcamentoId);

      if (orcError) throw orcError;

      // Update lead with vendedor_id (primary) + vendedor text (backward compat)
      const { error: leadError } = await supabase
        .from("leads")
        .update({
          vendedor_id: selectedVendedorId,
          vendedor: vendedorNome,
          distribuido_em: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (leadError) throw leadError;

      toast({
        title: "Vendedor atribuído!",
        description: `Orçamento transferido para ${vendedorNome}.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error assigning vendedor:", error);
      toast({
        title: "Erro ao atribuir",
        description: "Não foi possível atribuir o vendedor. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveVendor = async () => {
    setSaving(true);
    try {
      // Get tenant_id from the lead itself
      const { data: leadData } = await supabase
        .from("leads")
        .select("tenant_id")
        .eq("id", leadId)
        .single();

      const { data: defaultVendedor, error: resolveError } = await supabase
        .rpc("resolve_default_vendedor_id", { _tenant_id: leadData?.tenant_id });

      if (resolveError || !defaultVendedor) {
        throw new Error("Não foi possível resolver vendedor padrão da fila");
      }

      // Get default vendedor name
      const { data: vendedorData } = await supabase
        .from("vendedores")
        .select("nome")
        .eq("id", defaultVendedor)
        .single();

      const { error: orcError } = await supabase
        .from("orcamentos")
        .update({ vendedor: vendedorData?.nome || null })
        .eq("id", orcamentoId);

      if (orcError) throw orcError;

      const { error: leadError } = await supabase
        .from("leads")
        .update({ vendedor: vendedorData?.nome || null, vendedor_id: defaultVendedor })
        .eq("id", leadId);

      if (leadError) throw leadError;

      toast({
        title: "Devolvido à fila",
        description: "O lead foi reatribuído ao vendedor padrão.",
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Atribuir Vendedor
          </DialogTitle>
          <DialogDescription>
            Transfira o orçamento de <strong>{clienteNome}</strong> para um vendedor
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {displayName && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Vendedor atual:</span>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {displayName}
              </Badge>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo vendedor</label>
              <Select value={selectedVendedorId} onValueChange={setSelectedVendedorId}>
                <SelectTrigger className="w-full bg-background">
                  <SelectValue placeholder="Selecione um vendedor..." />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover border border-border shadow-lg">
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="flex items-center gap-2">
                        {v.nome}
                        {v.codigo && (
                          <span className="text-xs text-muted-foreground">({v.codigo})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {displayName && (
            <Button
              variant="outline"
              onClick={handleRemoveVendor}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              Remover Vendedor
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={saving || !selectedVendedorId}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
