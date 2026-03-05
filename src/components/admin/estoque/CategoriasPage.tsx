import { useState } from "react";
import { Tag, Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { useEstoqueCategorias, useCreateEstoqueCategoria, useUpdateEstoqueCategoria, useDeleteEstoqueCategoria, type EstoqueCategoria } from "@/hooks/useEstoqueCategorias";
import { CategoriaEditDialog } from "./CategoriaEditDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function CategoriasPage() {
  const { data: categorias = [], isLoading } = useEstoqueCategorias();
  const deleteMut = useDeleteEstoqueCategoria();

  const [editItem, setEditItem] = useState<EstoqueCategoria | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) return <InlineLoader />;

  const parents = categorias.filter((c) => !c.parent_id && c.ativo);
  const getChildren = (parentId: string) => categorias.filter((c) => c.parent_id === parentId && c.ativo);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Tag}
        title="Categorias de Estoque"
        description="Organize seus itens por categoria e subcategoria"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => { setCreateParentId(null); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova Categoria
          </Button>
        }
      />

      {parents.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Nenhuma categoria customizada"
          description="Crie categorias para organizar melhor seu estoque."
          action={{ label: "Nova Categoria", onClick: () => { setCreateParentId(null); setCreateOpen(true); } }}
        />
      ) : (
        <div className="space-y-3">
          {parents.map((cat) => {
            const children = getChildren(cat.id);
            return (
              <div key={cat.id} className="rounded-xl border bg-card shadow-sm">
                <div className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Tag className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{cat.nome}</p>
                    <p className="text-xs text-muted-foreground">{cat.slug}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{children.length} sub</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setCreateParentId(cat.id); setCreateOpen(true); }}>
                      <Plus className="h-3 w-3" /> Sub
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(cat)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(cat.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {children.length > 0 && (
                  <div className="border-t px-4 pb-3 pt-2 space-y-1">
                    {children.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 pl-6 py-1.5 rounded-md hover:bg-muted/50">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm flex-1">{sub.nome}</span>
                        <span className="text-[10px] text-muted-foreground">{sub.slug}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditItem(sub)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteId(sub.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CategoriaEditDialog open={createOpen} onOpenChange={setCreateOpen} categoria={null} parentId={createParentId} allCategorias={categorias} />
      {editItem && (
        <CategoriaEditDialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)} categoria={editItem} parentId={editItem.parent_id} allCategorias={categorias} />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>A categoria e suas subcategorias serão desativadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteId) deleteMut.mutate(deleteId); setDeleteId(null); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CategoriasPage;
