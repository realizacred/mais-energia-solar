import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Plus, CheckSquare, Search } from "lucide-react";
import type { CreateTaskInput, TaskPriority, RelatedType } from "@/hooks/useTasks";

export function CreateTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  vendedores,
  initialProjectId,
  projetos = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: CreateTaskInput) => void;
  isSubmitting: boolean;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  initialProjectId?: string;
  projetos?: { id: string; codigo: string | null; cliente?: { nome: string } | null }[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("P2");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [relatedId, setRelatedId] = useState("");
  const [relatedType, setRelatedType] = useState<RelatedType>("projeto");
  const [searchTerm, setSearchQuery] = useState("");

  useEffect(() => {
    if (initialProjectId) {
      setRelatedId(initialProjectId);
      setRelatedType("projeto");
    }
  }, [initialProjectId]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assignedTo || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      related_id: relatedId || null,
      related_type: relatedId ? relatedType : null,
    });
    setTitle("");
    setDescription("");
    setPriority("P2");
    setAssignedTo("");
    setDueAt("");
    setRelatedId("");
    setSearchQuery("");
  };

  const filteredProjetos = projetos.filter(p => 
    !searchTerm || 
    p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cliente?.nome.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 10);

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => onOpenChange(true)}>
        <Plus className="h-4 w-4" />
        Nova Tarefa
      </Button>
      <FormModalTemplate
        open={open}
        onOpenChange={onOpenChange}
        title="Nova Tarefa"
        icon={CheckSquare}
        subtitle="Crie uma nova tarefa"
        submitLabel="Criar Tarefa"
        onSubmit={handleSubmit}
        saving={isSubmitting}
        disabled={!title.trim()}
      >
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ligar para cliente X" />
            </div>
            
            <div className="space-y-2">
              <Label>Vincular a Projeto (Opcional)</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar projeto por código ou cliente..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={relatedId} onValueChange={setRelatedId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.codigo || "S/C"} - {p.cliente?.nome || "S/N"}
                    </SelectItem>
                  ))}
                  {projetos.length > 0 && filteredProjetos.length === 0 && (
                    <SelectItem value="none" disabled>Nenhum projeto encontrado</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>

            <FormGrid>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P0">P0 - Urgente</SelectItem>
                    <SelectItem value="P1">P1 - Alto</SelectItem>
                    <SelectItem value="P2">P2 - Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </div>
            </FormGrid>
            <div className="space-y-2">
              <Label>Atribuir a</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecionar consultor" /></SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.user_id || v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
      </FormModalTemplate>
    </>
  );
}
