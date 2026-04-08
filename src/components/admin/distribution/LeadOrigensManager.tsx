import { useState } from "react";
import { Plus, Trash2, GripVertical, Globe } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useLeadOrigensTodas,
  useCriarLeadOrigem,
  useAtualizarLeadOrigem,
  useDeletarLeadOrigem,
} from "@/hooks/useLeadOrigens";
import { toast } from "sonner";

export function LeadOrigensManager() {
  const { data: origens = [], isLoading } = useLeadOrigensTodas();
  const criarMut = useCriarLeadOrigem();
  const atualizarMut = useAtualizarLeadOrigem();
  const deletarMut = useDeletarLeadOrigem();

  const [newNome, setNewNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);

  const handleAdd = async () => {
    if (!newNome.trim()) return;
    setSaving(true);
    try {
      await criarMut.mutateAsync({ nome: newNome.trim(), ordem: origens.length });
      setNewNome("");
      toast.success("Origem adicionada");
    } catch {
      toast.error("Erro ao adicionar origem");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    try {
      await atualizarMut.mutateAsync({ id, patch: { ativo } });
      toast.success(ativo ? "Origem ativada" : "Origem desativada");
    } catch {
      toast.error("Erro ao atualizar");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await deletarMut.mutateAsync(id);
      if (result.deactivated) {
        toast.info(`Origem desativada (${result.count} lead(s) vinculado(s))`);
      } else {
        toast.success("Origem excluída");
      }
    } catch {
      toast.error("Erro ao excluir");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header — §DS-03 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Origens de Lead</h1>
          <p className="text-sm text-muted-foreground">
            Configure as origens exibidas no cadastro de leads
          </p>
        </div>
      </div>

      {/* Add new */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Input
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              placeholder="Ex: Indicação, Instagram, Feira..."
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button onClick={handleAdd} disabled={saving || !newNome.trim()} className="gap-2 shrink-0">
              {saving ? <Spinner size="sm" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <Card>
          <CardContent><InlineLoader context="data_load" /></CardContent>
        </Card>
      ) : origens.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Globe className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma origem cadastrada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Adicione uma origem acima para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {origens.map((origem) => (
            <div
              key={origem.id}
              className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors ${!origem.ativo ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                </div>
                <p className="text-sm font-medium text-foreground">{origem.nome}</p>
                {!origem.ativo && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={origem.ativo}
                  onCheckedChange={(checked) => handleToggle(origem.id, checked)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="border-destructive text-destructive hover:bg-destructive/10 h-8 w-8"
                  onClick={() => setDeleteTarget({ id: origem.id, nome: origem.nome })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir origem "{deleteTarget?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se existirem leads vinculados a esta origem, ela será desativada ao invés de excluída.
              Origens desativadas não aparecem no formulário de cadastro, mas continuam visíveis nos leads antigos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir / Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
