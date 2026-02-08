import { useState } from "react";
import { Plus, Trash2, GripVertical, Eye, EyeOff, Loader2, Save, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useSiteBannersAdmin, type SiteBanner } from "@/hooks/useSiteBanners";

export function SiteBannersManager() {
  const { banners, loading, addBanner, updateBanner, deleteBanner } = useSiteBannersAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const [newBanner, setNewBanner] = useState({
    titulo: "",
    subtitulo: "",
    imagem_url: "",
    botao_texto: "",
    botao_link: "",
  });

  const handleAdd = async () => {
    if (!newBanner.imagem_url) {
      toast({ title: "URL da imagem é obrigatória", variant: "destructive" });
      return;
    }
    setSaving("new");
    const { error } = await addBanner({
      ...newBanner,
      ordem: banners.length,
      ativo: true,
      imagem_url: newBanner.imagem_url,
    });
    if (error) {
      toast({ title: "Erro ao adicionar", description: error, variant: "destructive" });
    } else {
      toast({ title: "Banner adicionado!" });
      setNewBanner({ titulo: "", subtitulo: "", imagem_url: "", botao_texto: "", botao_link: "" });
      setDialogOpen(false);
    }
    setSaving(null);
  };

  const handleToggle = async (banner: SiteBanner) => {
    setSaving(banner.id);
    await updateBanner(banner.id, { ativo: !banner.ativo });
    setSaving(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este banner?")) return;
    setSaving(id);
    const { error } = await deleteBanner(id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error, variant: "destructive" });
    } else {
      toast({ title: "Banner excluído" });
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Banners do Site</h3>
          <p className="text-sm text-muted-foreground">Gerencie os banners rotativos do site</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Novo Banner
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Banner</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL da Imagem *</Label>
                <Input value={newBanner.imagem_url} onChange={(e) => setNewBanner({ ...newBanner, imagem_url: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={newBanner.titulo} onChange={(e) => setNewBanner({ ...newBanner, titulo: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Input value={newBanner.subtitulo} onChange={(e) => setNewBanner({ ...newBanner, subtitulo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Texto do Botão</Label>
                  <Input value={newBanner.botao_texto} onChange={(e) => setNewBanner({ ...newBanner, botao_texto: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Link do Botão</Label>
                  <Input value={newBanner.botao_link} onChange={(e) => setNewBanner({ ...newBanner, botao_link: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleAdd} disabled={saving === "new"} className="w-full gap-2">
                {saving === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Adicionar Banner
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {banners.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum banner cadastrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners.map((banner) => (
            <Card key={banner.id} className={!banner.ativo ? "opacity-60" : ""}>
              <CardContent className="flex items-center gap-4 py-4">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />
                
                <div className="w-24 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                  <img src={banner.imagem_url} alt={banner.titulo || "Banner"} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{banner.titulo || "Sem título"}</p>
                  <p className="text-xs text-muted-foreground truncate">{banner.subtitulo || banner.imagem_url}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleToggle(banner)} disabled={saving === banner.id}>
                    {banner.ativo ? <Eye className="w-4 h-4 text-success" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(banner.id)} disabled={saving === banner.id}>
                    <Trash2 className="w-4 h-4 text-destructive" />
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
