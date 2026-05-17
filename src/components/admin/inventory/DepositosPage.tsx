import { useState } from "react";
import { Warehouse, Plus, Pencil, Trash2, Truck, HardHat } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineLoader } from "@/components/loading/InlineLoader";
import {
  useAllEstoqueLocais,
  useCreateEstoqueLocal,
  useUpdateEstoqueLocal,
  useDeleteEstoqueLocal,
  type EstoqueLocal,
} from "@/hooks/useEstoque";
import { LocalEditDialog } from "./LocalEditDialog";
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

const TIPO_LABELS: Record<string, string> = {
  warehouse: "Almoxarifado",
  vehicle: "Veículo",
  site: "Obra",
};

const TIPO_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  warehouse: Warehouse,
  vehicle: Truck,
  site: HardHat,
};

export function DepositosPage() {
  const { data: locais = [], isLoading } = useAllEstoqueLocais();
  const deleteMut = useDeleteEstoqueLocal();

  const [editLocal, setEditLocal] = useState<EstoqueLocal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const activeLocais = locais.filter((l) => l.ativo);
  const inactiveLocais = locais.filter((l) => !l.ativo);

  if (isLoading) return <InlineLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Warehouse}
        title="Depósitos"
        description="Gerencie seus locais de armazenamento"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Depósito
          </Button>
        }
      />

      {activeLocais.length === 0 && inactiveLocais.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Nenhum depósito cadastrado"
          description="Crie seu primeiro local de armazenamento."
          action={{ label: "Novo Depósito", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeLocais.map((local) => {
            const Icon = TIPO_ICONS[local.tipo] || Warehouse;
            return (
              <div
                key={local.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{local.nome}</p>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">
                    {TIPO_LABELS[local.tipo] || local.tipo}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditLocal(local)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(local.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {inactiveLocais.map((local) => {
            const Icon = TIPO_ICONS[local.tipo] || Warehouse;
            return (
              <div
                key={local.id}
                className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4 shadow-sm opacity-60"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate line-through">{local.nome}</p>
                  <Badge variant="outline" className="text-[10px] mt-0.5">Inativo</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <LocalEditDialog open={createOpen} onOpenChange={setCreateOpen} local={null} />

      {/* Edit dialog */}
      {editLocal && (
        <LocalEditDialog
          open={!!editLocal}
          onOpenChange={(o) => !o && setEditLocal(null)}
          local={editLocal}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover depósito?</AlertDialogTitle>
            <AlertDialogDescription>
              O depósito será desativado e não aparecerá mais nas seleções. Itens já vinculados não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteMut.mutate(deleteId);
                setDeleteId(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
