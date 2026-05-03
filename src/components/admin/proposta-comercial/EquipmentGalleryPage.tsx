/**
 * EquipmentGalleryPage — Galeria de fotos de equipamentos por tenant.
 * Cada empresa faz upload das próprias fotos (módulos, inversores, stringbox, cabos, estruturas).
 * Reaproveita: useEquipmentGallery + bucket public 'equipment-images'.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, ImageIcon, Plus } from "lucide-react";
import {
  EQUIPMENT_CATEGORY_LABELS,
  EquipmentImageCategory,
  useDeleteEquipmentImage,
  useEquipmentGallery,
  useUploadEquipmentImage,
} from "@/hooks/useEquipmentGallery";

const CATEGORIES = Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentImageCategory[];

export function EquipmentGalleryPage() {
  const [active, setActive] = useState<EquipmentImageCategory>("modulo");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Galeria de Equipamentos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Suba as fotos dos equipamentos que sua empresa usa nas propostas (módulos, inversores, string box CC, cabos, estruturas).
            As imagens ficam disponíveis para todos os modelos de proposta.
          </p>
        </CardHeader>
      </Card>

      <Tabs value={active} onValueChange={(v) => setActive(v as EquipmentImageCategory)}>
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c} className="text-xs sm:text-sm shrink-0 whitespace-nowrap">
              {EQUIPMENT_CATEGORY_LABELS[c]}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((c) => (
          <TabsContent key={c} value={c} className="mt-4">
            <CategoryGallery category={c} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CategoryGallery({ category }: { category: EquipmentImageCategory }) {
  const { data: images = [], isLoading } = useEquipmentGallery(category);
  const del = useDeleteEquipmentImage();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {images.length} {images.length === 1 ? "imagem" : "imagens"} em{" "}
          <strong>{EQUIPMENT_CATEGORY_LABELS[category]}</strong>
        </p>
        <UploadDialog defaultCategory={category} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : images.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma imagem cadastrada nesta categoria.
            <br />
            Clique em <strong>Adicionar imagem</strong> para subir a primeira foto.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img) => (
            <Card key={img.id} className="overflow-hidden group">
              <div className="aspect-square bg-muted relative">
                <img
                  src={img.image_url}
                  alt={img.label || img.modelo || "equipamento"}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition h-7 w-7"
                  onClick={() => del.mutate(img)}
                  disabled={del.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <CardContent className="p-2">
                <p className="text-xs font-medium truncate">
                  {img.label || img.modelo || "Sem nome"}
                </p>
                {img.fabricante && (
                  <p className="text-[10px] text-muted-foreground truncate">{img.fabricante}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadDialog({ defaultCategory }: { defaultCategory: EquipmentImageCategory }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<EquipmentImageCategory>(defaultCategory);
  const [fabricante, setFabricante] = useState("");
  const [modelo, setModelo] = useState("");
  const [label, setLabel] = useState("");
  const upload = useUploadEquipmentImage();

  const handleSubmit = async () => {
    if (!file) return;
    await upload.mutateAsync({ file, category, fabricante, modelo, label });
    setOpen(false);
    setFile(null);
    setFabricante("");
    setModelo("");
    setLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Adicionar imagem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova imagem de equipamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as EquipmentImageCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {EQUIPMENT_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Arquivo (JPG, PNG, WEBP)</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Fabricante</Label>
              <Input
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                placeholder="Ex: Canadian Solar"
              />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Ex: HiKu7 580W"
              />
            </div>
          </div>
          <div>
            <Label>Apelido (opcional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Módulo padrão residencial"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || upload.isPending} className="gap-1.5">
            <Upload className="h-4 w-4" />
            {upload.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
