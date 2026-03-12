import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Plus, CheckSquare } from "lucide-react";
import type { CreateTaskInput, TaskPriority } from "@/hooks/useTasks";

export function CreateTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  vendedores,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (input: CreateTaskInput) => void;
  isSubmitting: boolean;
  vendedores: { id: string; nome: string; user_id: string | null }[];
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("P2");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      assigned_to: assignedTo || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setTitle("");
    setDescription("");
    setPriority("P2");
    setAssignedTo("");
    setDueAt("");
  };

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
