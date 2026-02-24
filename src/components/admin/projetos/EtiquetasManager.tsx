import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Etiqueta {
  id: string;
  nome: string;
  cor: string;
  grupo: string;
  short: string | null;
  icon: string | null;
  ordem: number;
  ativo: boolean;
}

const GRUPO_OPTIONS = [
  { value: "fornecedor", label: "Fornecedor" },
  { value: "pagamento", label: "Forma de pagamento" },
  { value: "prioridade", label: "Prioridade / Alertas" },
  { value: "geral", label: "Geral" },
];

const COLOR_PRESETS = [
  "hsl(210,80%,50%)",   // blue
  "hsl(0,60%,50%)",     // red
  "hsl(142,70%,45%)",   // green
  "hsl(45,90%,50%)",    // yellow
  "hsl(270,50%,50%)",   // purple
  "hsl(28,95%,53%)",    // orange
  "hsl(0,0%,50%)",      // gray
  "hsl(190,80%,45%)",   // teal
];

export function EtiquetasManager() {
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", cor: COLOR_PRESETS[0], grupo: "fornecedor", short: "", icon: "" });
  const { toast } = useToast();

  const fetchEtiquetas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projeto_etiquetas")
      .select("id, nome, cor, grupo, short, icon, ordem, ativo")
      .order("grupo")
      .order("ordem");
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setEtiquetas((data || []) as Etiqueta[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchEtiquetas(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ nome: "", cor: COLOR_PRESETS[0], grupo: "fornecedor", short: "", icon: "" });
    setDialogOpen(true);
  };

  const openEdit = (et: Etiqueta) => {
    setEditingId(et.id);
    setForm({ nome: et.nome, cor: et.cor, grupo: et.grupo, short: et.short || "", icon: et.icon || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("projeto_etiquetas")
        .update({ nome: form.nome, cor: form.cor, grupo: form.grupo, short: form.short || null, icon: form.icon || null })
        .eq("id", editingId);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Etiqueta atualizada" });
    } else {
      const ordem = etiquetas.filter(e => e.grupo === form.grupo).length;
      const { error } = await supabase
        .from("projeto_etiquetas")
        .insert({ nome: form.nome, cor: form.cor, grupo: form.grupo, short: form.short || null, icon: form.icon || null, ordem } as any);
      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Etiqueta criada" });
    }

    setDialogOpen(false);
    fetchEtiquetas();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("projeto_etiquetas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Etiqueta excluída" });
    fetchEtiquetas();
  };

  const grouped = GRUPO_OPTIONS.map(g => ({
    ...g,
    items: etiquetas.filter(e => e.grupo === g.value),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Gerenciar etiquetas
          </h2>
          <p className="text-sm text-muted-foreground">Crie, edite e organize as etiquetas do sistema</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nova etiqueta
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid gap-4">
          {grouped.map(group => (
            <Card key={group.value} className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 italic py-2">Nenhuma etiqueta neste grupo</p>
                ) : (
                  group.items.map(et => (
                    <div
                      key={et.id}
                      className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2 bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab" />
                        <div
                          className="w-4 h-4 rounded-full border border-border/60 shrink-0"
                          style={{ backgroundColor: et.cor }}
                        />
                        <span className="text-sm font-medium text-foreground">{et.icon} {et.nome}</span>
                        {et.short && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">{et.short}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(et)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(et.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <FormModalTemplate
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? "Editar etiqueta" : "Nova etiqueta"}
        onSubmit={handleSave}
        submitLabel={editingId ? "Salvar" : "Criar"}
        className="sm:max-w-md"
      >
            <div className="space-y-2">
              <Label className="text-xs font-medium">Nome</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: WEG, À Vista, Urgente"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Grupo</Label>
              <Select value={form.grupo} onValueChange={v => setForm(f => ({ ...f, grupo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRUPO_OPTIONS.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Abreviação</Label>
              <Input
                value={form.short}
                onChange={e => setForm(f => ({ ...f, short: e.target.value }))}
                placeholder="Ex: WEG, FIN, URG"
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Ícone (emoji)</Label>
              <Input
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="🟦"
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Cor</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, cor: c }))}
                    className={cn(
                      "w-8 h-8 rounded-lg border-2 transition-all",
                      form.cor === c ? "border-foreground scale-110" : "border-border/40"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={form.cor}
                  onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                  placeholder="hsl(210,80%,50%)"
                  className="text-xs font-mono"
                />
                <div className="w-8 h-8 rounded-lg border border-border/40 shrink-0" style={{ backgroundColor: form.cor }} />
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Preview</Label>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                <Badge
                  className="text-[10px] font-bold border px-2 py-0.5"
                  style={{
                    backgroundColor: `${form.cor}20`,
                    color: form.cor,
                    borderColor: `${form.cor}40`,
                  }}
                >
                  {form.icon} {form.short || form.nome || "Preview"}
                </Badge>
                <span className="text-sm text-muted-foreground">{form.nome || "Nome da etiqueta"}</span>
              </div>
            </div>
      </FormModalTemplate>
    </div>
  );
}
