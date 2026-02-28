import { useState } from "react";
import {
  useChecklistTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  useCreateTemplateItem,
  useUpdateTemplateItem,
  useDeleteTemplateItem,
  ChecklistTemplate,
} from "@/hooks/usePostSaleChecklist";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Plus, Trash2, ClipboardList, GripVertical } from "lucide-react";

const TIPOS = [
  { value: "preventiva", label: "Preventiva" },
  { value: "limpeza", label: "Limpeza" },
  { value: "suporte", label: "Suporte" },
  { value: "vistoria", label: "Vistoria" },
  { value: "corretiva", label: "Corretiva" },
];

export function PostSaleChecklistsPage() {
  const { data: templates = [], isLoading } = useChecklistTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const createItem = useCreateTemplateItem();
  const updateItem = useUpdateTemplateItem();
  const deleteItem = useDeleteTemplateItem();

  const [createOpen, setCreateOpen] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState("preventiva");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newItemDesc, setNewItemDesc] = useState("");

  const handleCreate = () => {
    if (!newNome.trim()) return;
    createTemplate.mutate({ nome: newNome.trim(), tipo: newTipo }, {
      onSuccess: () => { setCreateOpen(false); setNewNome(""); },
    });
  };

  const handleAddItem = (templateId: string, currentCount: number) => {
    if (!newItemDesc.trim()) return;
    createItem.mutate({ template_id: templateId, descricao: newItemDesc.trim(), ordem: currentCount + 1 }, {
      onSuccess: () => setNewItemDesc(""),
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Templates de Checklist</h2>
        <Button size="sm" className="gap-1" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum template" description="Crie um template de checklist para usar nas visitas." />
      ) : (
        <div className="space-y-3">
          {templates.map(t => {
            const isOpen = expanded === t.id;
            return (
              <SectionCard key={t.id} title={t.nome} description={`${t.items?.length ?? 0} itens`}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-xs capitalize">{t.tipo}</Badge>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setExpanded(isOpen ? null : t.id)}>
                    {isOpen ? "Recolher" : "Editar itens"}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 ml-auto text-destructive"
                    onClick={() => deleteTemplate.mutate(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {isOpen && (
                  <div className="space-y-2">
                    {(t.items ?? []).map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2 p-2 rounded border border-border/50 bg-muted/20">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1">{item.descricao}</span>
                        <span className="text-xs text-muted-foreground">#{item.ordem}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => deleteItem.mutate(item.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Descrição do novo item..."
                        value={newItemDesc}
                        onChange={e => setNewItemDesc(e.target.value)}
                        className="text-sm h-8"
                        onKeyDown={e => e.key === "Enter" && handleAddItem(t.id, t.items?.length ?? 0)}
                      />
                      <Button size="sm" variant="outline" className="shrink-0 h-8"
                        onClick={() => handleAddItem(t.id, t.items?.length ?? 0)}
                        disabled={!newItemDesc.trim()}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome do template" value={newNome} onChange={e => setNewNome(e.target.value)} />
            <Select value={newTipo} onValueChange={setNewTipo}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createTemplate.isPending || !newNome.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PostSaleChecklistsPage;
