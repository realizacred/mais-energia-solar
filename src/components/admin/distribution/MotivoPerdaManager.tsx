import { useState } from "react";
import { Plus, Trash2, GripVertical, TrendingDown } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useMotivosPerda } from "@/hooks/useDistribution";

export function MotivoPerdaManager() {
  const { motivos, loading, upsert, remove } = useMotivosPerda();
  const [newNome, setNewNome] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newNome.trim()) return;
    setSaving(true);
    try {
      await upsert({ nome: newNome.trim(), ativo: true, ordem: motivos.length });
      setNewNome("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header — §26 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <TrendingDown className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Motivos de Perda</h1>
          <p className="text-sm text-muted-foreground">
            Configure os motivos exibidos ao marcar um lead como perdido
          </p>
        </div>
      </div>

      {/* Add new — input com bg-card */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Input
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              placeholder="Ex: Preço alto, Optou por concorrente..."
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
      {loading ? (
        <Card>
          <CardContent><InlineLoader context="data_load" /></CardContent>
        </Card>
      ) : motivos.length === 0 ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TrendingDown className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum motivo cadastrado</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Adicione um motivo acima para começar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {motivos.map((motivo) => (
            <div
              key={motivo.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                </div>
                <p className="text-sm font-medium text-foreground">{motivo.nome}</p>
                {!motivo.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={motivo.ativo ?? true}
                  onCheckedChange={(checked) => upsert({ id: motivo.id, nome: motivo.nome, ativo: checked })}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="border-destructive text-destructive hover:bg-destructive/10 h-8 w-8"
                  onClick={() => remove(motivo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
