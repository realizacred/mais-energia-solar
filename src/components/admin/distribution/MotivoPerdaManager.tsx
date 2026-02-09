import { useState } from "react";
import { Plus, Trash2, GripVertical, Loader2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 border border-destructive/10">
          <XCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Motivos de Perda</h2>
          <p className="text-sm text-muted-foreground">
            Configure os motivos exibidos ao marcar um lead como perdido
          </p>
        </div>
      </div>

      {/* Add new */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Input
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              placeholder="Ex: Preço alto, Optou por concorrente..."
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={saving || !newNome.trim()} className="gap-2 shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : motivos.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-base font-semibold">Nenhum motivo cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {motivos.map((motivo) => (
            <Card key={motivo.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  <p className="text-sm font-medium">{motivo.nome}</p>
                  {!motivo.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={motivo.ativo ?? true}
                    onCheckedChange={(checked) => upsert({ id: motivo.id, nome: motivo.nome, ativo: checked })}
                  />
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => remove(motivo.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
