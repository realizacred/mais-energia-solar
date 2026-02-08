import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Star, Upload, X,
  Loader2, ImageIcon, Video, MapPin, Zap, GripVertical
} from "lucide-react";
import { ESTADOS_BRASIL } from "@/lib/validations";

interface Obra {
  id: string;
  titulo: string;
  descricao: string | null;
  cidade: string;
  estado: string;
  potencia_kwp: number | null;
  economia_mensal: number | null;
  tipo_projeto: string;
  data_conclusao: string | null;
  imagens_urls: string[];
  video_url: string | null;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
  numero_modulos: number | null;
  modelo_inversor: string | null;
  cliente_nome: string | null;
  created_at: string;
}

const TIPOS_PROJETO = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "industrial", label: "Industrial" },
  { value: "rural", label: "Rural / Agro" },
  { value: "condominio", label: "Condomínio" },
];

const emptyForm = {
  titulo: "",
  descricao: "",
  cidade: "",
  estado: "MG",
  potencia_kwp: "",
  economia_mensal: "",
  tipo_projeto: "residencial",
  data_conclusao: "",
  video_url: "",
  destaque: false,
  ativo: true,
  ordem: 0,
  numero_modulos: "",
  modelo_inversor: "",
  cliente_nome: "",
};

export function ObrasManager() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchObras = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("obras")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setObras((data as unknown as Obra[]) || []);
    } catch (error) {
      const appError = handleSupabaseError(error, "fetch_obras");
      toast({ title: "Erro", description: appError.userMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchObras(); }, [fetchObras]);

  const openNew = () => {
    setEditingObra(null);
    setForm(emptyForm);
    setPendingImages([]);
    setDialogOpen(true);
  };

  const openEdit = (obra: Obra) => {
    setEditingObra(obra);
    setForm({
      titulo: obra.titulo,
      descricao: obra.descricao || "",
      cidade: obra.cidade,
      estado: obra.estado,
      potencia_kwp: obra.potencia_kwp?.toString() || "",
      economia_mensal: obra.economia_mensal?.toString() || "",
      tipo_projeto: obra.tipo_projeto,
      data_conclusao: obra.data_conclusao || "",
      video_url: obra.video_url || "",
      destaque: obra.destaque,
      ativo: obra.ativo,
      ordem: obra.ordem,
      numero_modulos: obra.numero_modulos?.toString() || "",
      modelo_inversor: obra.modelo_inversor || "",
      cliente_nome: obra.cliente_nome || "",
    });
    setPendingImages(obra.imagens_urls || []);
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploadingImages(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("obras-portfolio")
          .upload(path, file, { cacheControl: "3600", upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("obras-portfolio")
          .getPublicUrl(path);

        newUrls.push(urlData.publicUrl);
      }

      setPendingImages((prev) => [...prev, ...newUrls]);
      toast({ title: `${newUrls.length} imagem(ns) enviada(s)` });
    } catch (error) {
      const appError = handleSupabaseError(error, "upload_obra_images");
      toast({ title: "Erro no upload", description: appError.userMessage, variant: "destructive" });
    } finally {
      setUploadingImages(false);
      e.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.cidade.trim()) {
      toast({ title: "Preencha título e cidade", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        cidade: form.cidade.trim(),
        estado: form.estado,
        potencia_kwp: form.potencia_kwp ? Number(form.potencia_kwp) : null,
        economia_mensal: form.economia_mensal ? Number(form.economia_mensal) : null,
        tipo_projeto: form.tipo_projeto,
        data_conclusao: form.data_conclusao || null,
        imagens_urls: pendingImages,
        video_url: form.video_url.trim() || null,
        destaque: form.destaque,
        ativo: form.ativo,
        ordem: form.ordem,
        numero_modulos: form.numero_modulos ? Number(form.numero_modulos) : null,
        modelo_inversor: form.modelo_inversor.trim() || null,
        cliente_nome: form.cliente_nome.trim() || null,
      };

      if (editingObra) {
        const { error } = await supabase
          .from("obras")
          .update(payload)
          .eq("id", editingObra.id);
        if (error) throw error;
        toast({ title: "Obra atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("obras")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Obra adicionada com sucesso!" });
      }

      setDialogOpen(false);
      fetchObras();
    } catch (error) {
      const appError = handleSupabaseError(error, editingObra ? "update_obra" : "create_obra");
      toast({ title: "Erro ao salvar", description: appError.userMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("obras").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Obra excluída" });
      setDeleteConfirm(null);
      fetchObras();
    } catch (error) {
      const appError = handleSupabaseError(error, "delete_obra", { entityId: id });
      toast({ title: "Erro ao excluir", description: appError.userMessage, variant: "destructive" });
    }
  };

  const toggleActive = async (obra: Obra) => {
    try {
      const { error } = await supabase
        .from("obras")
        .update({ ativo: !obra.ativo })
        .eq("id", obra.id);
      if (error) throw error;
      fetchObras();
    } catch (error) {
      handleSupabaseError(error, "toggle_obra_ativo");
    }
  };

  const toggleDestaque = async (obra: Obra) => {
    try {
      const { error } = await supabase
        .from("obras")
        .update({ destaque: !obra.destaque })
        .eq("id", obra.id);
      if (error) throw error;
      fetchObras();
    } catch (error) {
      handleSupabaseError(error, "toggle_obra_destaque");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">Portfólio de Obras</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie as obras exibidas na seção "Obras Realizadas" do site.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Obra
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : obras.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><ImageIcon className="w-8 h-8 text-muted-foreground" /></div>
          <p className="empty-state-title">Nenhuma obra cadastrada</p>
          <p className="empty-state-description">Adicione obras ao portfólio para exibi-las no site.</p>
          <Button onClick={openNew} className="mt-4 gap-2"><Plus className="w-4 h-4" /> Adicionar Obra</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {obras.map((obra) => (
            <Card
              key={obra.id}
              className={`overflow-hidden transition-all duration-200 ${!obra.ativo ? "opacity-60" : ""}`}
            >
              {/* Image Preview */}
              <div className="relative h-40 bg-muted">
                {obra.imagens_urls?.[0] ? (
                  <img
                    src={obra.imagens_urls[0]}
                    alt={obra.titulo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-2 left-2 flex gap-1.5">
                  {obra.destaque && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                      <Star className="w-3 h-3" /> Destaque
                    </Badge>
                  )}
                  {!obra.ativo && (
                    <Badge variant="secondary" className="text-[10px]">
                      <EyeOff className="w-3 h-3 mr-1" /> Oculta
                    </Badge>
                  )}
                </div>

                {obra.video_url && (
                  <Badge className="absolute top-2 right-2 bg-foreground/70 text-background text-[10px] gap-1">
                    <Video className="w-3 h-3" /> Vídeo
                  </Badge>
                )}

                {/* Image count */}
                {obra.imagens_urls?.length > 1 && (
                  <Badge className="absolute bottom-2 right-2 bg-foreground/70 text-background text-[10px]">
                    {obra.imagens_urls.length} fotos
                  </Badge>
                )}
              </div>

              <CardContent className="p-3 space-y-2">
                <h4 className="font-semibold text-sm truncate">{obra.titulo}</h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {obra.cidade} - {obra.estado}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {obra.potencia_kwp && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Zap className="w-3 h-3" /> {obra.potencia_kwp} kWp
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {TIPOS_PROJETO.find(t => t.value === obra.tipo_projeto)?.label || obra.tipo_projeto}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(obra)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => toggleActive(obra)}
                  >
                    {obra.ativo ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                    {obra.ativo ? "Ocultar" : "Mostrar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => toggleDestaque(obra)}
                  >
                    <Star className={`w-3 h-3 mr-1 ${obra.destaque ? "fill-primary text-primary" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto"
                    onClick={() => setDeleteConfirm(obra.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingObra ? "Editar Obra" : "Nova Obra"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <Label>Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ex: Projeto Fotovoltaico de 5.5 kWp"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição detalhada da obra..."
                className="min-h-[80px]"
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade *</Label>
                <Input
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  placeholder="Cataguases"
                />
              </div>
              <div>
                <Label>Estado *</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {ESTADOS_BRASIL.map((e) => (
                      <SelectItem key={e.sigla} value={e.sigla}>{e.sigla} - {e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type and Client */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de Projeto</Label>
                <Select value={form.tipo_projeto} onValueChange={(v) => setForm({ ...form, tipo_projeto: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {TIPOS_PROJETO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome do Cliente</Label>
                <Input
                  value={form.cliente_nome}
                  onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Technical Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label>Potência (kWp)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.potencia_kwp}
                  onChange={(e) => setForm({ ...form, potencia_kwp: e.target.value })}
                  placeholder="5.50"
                />
              </div>
              <div>
                <Label>Economia (R$/mês)</Label>
                <Input
                  type="number"
                  value={form.economia_mensal}
                  onChange={(e) => setForm({ ...form, economia_mensal: e.target.value })}
                  placeholder="680"
                />
              </div>
              <div>
                <Label>Nº Módulos</Label>
                <Input
                  type="number"
                  value={form.numero_modulos}
                  onChange={(e) => setForm({ ...form, numero_modulos: e.target.value })}
                  placeholder="10"
                />
              </div>
              <div>
                <Label>Modelo Inversor</Label>
                <Input
                  value={form.modelo_inversor}
                  onChange={(e) => setForm({ ...form, modelo_inversor: e.target.value })}
                  placeholder="Growatt"
                />
              </div>
            </div>

            {/* Date and Order */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Conclusão</Label>
                <Input
                  type="date"
                  value={form.data_conclusao}
                  onChange={(e) => setForm({ ...form, data_conclusao: e.target.value })}
                />
              </div>
              <div>
                <Label>Ordem de Exibição</Label>
                <Input
                  type="number"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Video */}
            <div>
              <Label className="flex items-center gap-1.5">
                <Video className="w-4 h-4" /> URL do Vídeo (YouTube/Vimeo)
              </Label>
              <Input
                value={form.video_url}
                onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>

            {/* Images */}
            <div>
              <Label className="flex items-center gap-1.5 mb-2">
                <ImageIcon className="w-4 h-4" /> Imagens
              </Label>

              {/* Upload Area */}
              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImages}
                />
                {uploadingImages ? (
                  <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> Enviando...</>
                ) : (
                  <><Upload className="w-5 h-5 text-muted-foreground" /> <span className="text-sm text-muted-foreground">Arraste ou clique para enviar imagens</span></>
                )}
              </label>

              {/* Image Previews */}
              {pendingImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                  {pendingImages.map((url, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden aspect-square border border-border">
                      <img src={url} alt={`Imagem ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {idx === 0 && (
                        <Badge className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[9px]">
                          Capa
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Switches */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.destaque}
                  onCheckedChange={(v) => setForm({ ...form, destaque: v })}
                />
                <Label className="text-sm">Destaque</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                />
                <Label className="text-sm">Visível no site</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingObra ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Obra?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação não pode ser desfeita. A obra será removida permanentemente do portfólio.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
