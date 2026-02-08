import { useState } from "react";
import {
  Plus, Pencil, Trash2, Save, X, Loader2, GripVertical,
  ArrowUp, ArrowDown, Eye, EyeOff, Wrench, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useSiteServicos, type SiteServico } from "@/hooks/useSiteServicos";

// Default images that match the existing site assets
import serviceProjeto from "@/assets/service-projeto.jpg";
import serviceHomologacao from "@/assets/service-homologacao.jpg";
import serviceInstalacao from "@/assets/service-instalacao.jpg";
import serviceManutencao from "@/assets/service-manutencao.jpg";

const DEFAULT_IMAGES: Record<string, string> = {
  Projeto: serviceProjeto,
  Homologação: serviceHomologacao,
  Instalação: serviceInstalacao,
  Manutenção: serviceManutencao,
};

export function SiteServicosManager() {
  const { servicos, loading, addServico, updateServico, deleteServico, reorder } = useSiteServicos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SiteServico | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");

  const openNew = () => {
    setEditing(null);
    setTitulo("");
    setDescricao("");
    setImagemUrl("");
    setDialogOpen(true);
  };

  const openEdit = (s: SiteServico) => {
    setEditing(s);
    setTitulo(s.titulo);
    setDescricao(s.descricao);
    setImagemUrl(s.imagem_url || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!titulo.trim() || !descricao.trim()) {
      toast({ title: "Preencha título e descrição", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      imagem_url: imagemUrl.trim() || null,
    };

    const result = editing
      ? await updateServico(editing.id, payload)
      : await addServico(payload);

    if (result.error) {
      toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" });
    } else {
      toast({ title: editing ? "Serviço atualizado!" : "Serviço adicionado!" });
      setDialogOpen(false);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteServico(deleteId);
    if (result.error) {
      toast({ title: "Erro ao excluir", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "Serviço removido!" });
    }
    setDeleteId(null);
  };

  const handleToggleAtivo = async (s: SiteServico) => {
    await updateServico(s.id, { ativo: !s.ativo });
  };

  const moveUp = (index: number) => {
    if (index > 0) reorder(index, index - 1);
  };

  const moveDown = (index: number) => {
    if (index < servicos.length - 1) reorder(index, index + 1);
  };

  const getImage = (s: SiteServico) => {
    return s.imagem_url || DEFAULT_IMAGES[s.titulo] || serviceProjeto;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Wrench className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Nossos Serviços</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie os serviços exibidos na seção "Nossos Serviços" do site
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Serviço
        </Button>
      </div>

      {/* Service cards */}
      {servicos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">Nenhum serviço cadastrado</p>
            <p className="text-sm text-muted-foreground/60 mb-4">
              Adicione serviços para exibir na seção do site
            </p>
            <Button onClick={openNew} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" /> Adicionar primeiro serviço
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {servicos.map((s, index) => (
            <Card
              key={s.id}
              className={`transition-all duration-200 ${!s.ativo ? "opacity-50" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Order controls */}
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs font-bold text-muted-foreground w-7 text-center">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveDown(index)}
                      disabled={index === servicos.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Image preview */}
                  <div className="w-24 h-20 rounded-lg overflow-hidden shrink-0 bg-muted hidden sm:block">
                    <img
                      src={getImage(s)}
                      alt={s.titulo}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base">{s.titulo}</h3>
                      {!s.ativo && (
                        <Badge variant="secondary" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-1" /> Oculto
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {s.descricao}
                    </p>
                    {s.imagem_url && (
                      <p className="text-xs text-muted-foreground/50 mt-1 truncate flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> {s.imagem_url}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={s.ativo}
                      onCheckedChange={() => handleToggleAtivo(s)}
                      className="mr-2"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
            <DialogDescription>
              {editing ? "Atualize as informações do serviço" : "Adicione um novo serviço ao site"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Instalação"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o serviço..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>URL da Imagem (opcional)</Label>
              <Input
                value={imagemUrl}
                onChange={(e) => setImagemUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
              />
              <p className="text-xs text-muted-foreground">
                Se vazio, uma imagem padrão será usada
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O serviço será removido do site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
