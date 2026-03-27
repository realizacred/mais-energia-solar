import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import { getCurrentTenantId, tenantPath } from "@/lib/storagePaths";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormModalTemplate } from "@/components/ui-kit/FormModalTemplate";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Star, Upload, X,
  ImageIcon, Video, MapPin, Zap, Tag, Clock,
  MessageSquareQuote, TrendingUp, Link2, HardHat
} from "lucide-react";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PageHeader, EmptyState } from "@/components/ui-kit";
import { ESTADOS_BRASIL } from "@/lib/validations";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import {
  useObras,
  useObrasFormOptions,
  useSalvarObra,
  useDeletarObra,
  useToggleObraAtivo,
  useToggleObraDestaque,
  useObrasRealtime,
  type ObraRow,
} from "@/hooks/useObras";

type Obra = ObraRow;

const TIPOS_PROJETO = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
  { value: "industrial", label: "Industrial" },
  { value: "rural", label: "Rural / Agro" },
  { value: "condominio", label: "Condomínio" },
];

const TAGS_SUGERIDAS = [
  "telhado-ceramico", "telhado-metalico", "telhado-fibrocimento", "solo",
  "bifacial", "monocristalino", "microinversor", "string-inversor",
  "on-grid", "off-grid", "hibrido", "com-bateria",
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
  tags: [] as string[],
  marca_paineis: "",
  tempo_instalacao_dias: "",
  depoimento_cliente: "",
  payback_meses: "",
  projeto_id: "",
  cliente_id: "",
};

export function ObrasManager() {
  const { data: obras = [], isLoading: loading } = useObras();
  const { data: formOptions } = useObrasFormOptions();
  const projetos = formOptions?.projetos || [];
  const clientes = formOptions?.clientes || [];
  const salvarObra = useSalvarObra();
  const deletarObra = useDeletarObra();
  const toggleAtivo = useToggleObraAtivo();
  const toggleDestaque = useToggleObraDestaque();
  useObrasRealtime();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingObra, setEditingObra] = useState<Obra | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const { cidades, isLoading: cidadesLoading } = useCidadesPorEstado(form.estado);

  const openNew = () => {
    setEditingObra(null);
    setForm(emptyForm);
    setPendingImages([]);
    setTagInput("");
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
      tags: obra.tags || [],
      marca_paineis: obra.marca_paineis || "",
      tempo_instalacao_dias: obra.tempo_instalacao_dias?.toString() || "",
      depoimento_cliente: obra.depoimento_cliente || "",
      payback_meses: obra.payback_meses?.toString() || "",
      projeto_id: obra.projeto_id || "",
      cliente_id: obra.cliente_id || "",
    });
    setPendingImages(obra.imagens_urls || []);
    setTagInput("");
    setDialogOpen(true);
  };

  // --- Image handling ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingImages(true);
    const newUrls: string[] = [];
    try {
      const tid = await getCurrentTenantId();
      if (!tid) throw new Error("Tenant não encontrado");
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = tenantPath(tid, `${crypto.randomUUID()}.${ext}`);
        const { error: uploadError } = await supabase.storage
          .from("obras-portfolio")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("obras-portfolio").getPublicUrl(path);
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

  const setAsCover = (index: number) => {
    if (index === 0) return;
    setPendingImages((prev) => {
      const newArr = [...prev];
      const [img] = newArr.splice(index, 1);
      newArr.unshift(img);
      return newArr;
    });
  };

  // --- Tags ---
  const addTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!normalized || form.tags.includes(normalized)) return;
    setForm((f) => ({ ...f, tags: [...f.tags, normalized] }));
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  };

  // --- Save ---
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
        tags: form.tags,
        marca_paineis: form.marca_paineis.trim() || null,
        tempo_instalacao_dias: form.tempo_instalacao_dias ? Number(form.tempo_instalacao_dias) : null,
        depoimento_cliente: form.depoimento_cliente.trim() || null,
        payback_meses: form.payback_meses ? Number(form.payback_meses) : null,
        projeto_id: form.projeto_id || null,
        cliente_id: form.cliente_id || null,
      };

      await salvarObra.mutateAsync({ id: editingObra?.id, data: payload });
      toast({ title: editingObra ? "Obra atualizada com sucesso!" : "Obra adicionada com sucesso!" });
      setDialogOpen(false);
    } catch (error) {
      const appError = handleSupabaseError(error, editingObra ? "update_obra" : "create_obra");
      toast({ title: "Erro ao salvar", description: appError.userMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletarObra.mutateAsync(id);
      toast({ title: "Obra excluída" });
      setDeleteConfirm(null);
    } catch (error) {
      const appError = handleSupabaseError(error, "delete_obra", { entityId: id });
      toast({ title: "Erro ao excluir", description: appError.userMessage, variant: "destructive" });
    }
  };

  const handleToggleActive = async (obra: Obra) => {
    try {
      await toggleAtivo.mutateAsync({ id: obra.id, ativo: !obra.ativo });
    } catch (error) { handleSupabaseError(error, "toggle_obra_ativo"); }
  };

  const handleToggleDestaque = async (obra: Obra) => {
    try {
      await toggleDestaque.mutateAsync({ id: obra.id, destaque: !obra.destaque });
    } catch (error) { handleSupabaseError(error, "toggle_obra_destaque"); }
  };

  const availableSuggestedTags = TAGS_SUGERIDAS.filter((t) => !form.tags.includes(t));

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ImageIcon}
        title="Portfólio de Obras"
        description="Gerencie as obras exibidas na seção 'Obras Realizadas' do site."
        actions={
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Obra
          </Button>
        }
      />

      {/* List */}
      {loading ? (
        <InlineLoader context="data_load" />
      ) : obras.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhuma obra cadastrada"
          description="Adicione obras ao portfólio para exibi-las no site."
          action={{ label: "Adicionar Obra", onClick: openNew, icon: Plus }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {obras.map((obra) => (
            <Card key={obra.id} className={`overflow-hidden transition-all duration-200 ${!obra.ativo ? "opacity-60" : ""}`}>
              <div className="relative h-40 bg-muted">
                {obra.imagens_urls?.[0] ? (
                  <img src={obra.imagens_urls[0]} alt={obra.titulo} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                  </div>
                )}
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
                {obra.imagens_urls?.length > 1 && (
                  <Badge className="absolute bottom-2 right-2 bg-foreground/70 text-background text-[10px]">
                    {obra.imagens_urls.length} fotos
                  </Badge>
                )}
              </div>

              <CardContent className="p-3 space-y-2">
                <h4 className="font-semibold text-sm truncate">{obra.titulo}</h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" /> {obra.cidade} - {obra.estado}
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
                {obra.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {obra.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[9px] px-1.5">{tag}</Badge>
                    ))}
                    {obra.tags.length > 3 && (
                      <Badge variant="secondary" className="text-[9px] px-1.5">+{obra.tags.length - 3}</Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 pt-1 border-t border-border/40">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(obra)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleToggleActive(obra)}>
                    {obra.ativo ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                    {obra.ativo ? "Ocultar" : "Mostrar"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleToggleDestaque(obra)}>
                    <Star className={`w-3 h-3 mr-1 ${obra.destaque ? "fill-primary text-primary" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto" onClick={() => setDeleteConfirm(obra.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <FormModalTemplate
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingObra ? "Editar Obra" : "Nova Obra"}
        icon={HardHat}
        subtitle="Cadastre ou edite uma obra"
        onSubmit={handleSave}
        submitLabel={editingObra ? "Salvar" : "Adicionar"}
        saving={saving}
        className="max-w-2xl"
      >
            {/* Title */}
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Projeto Fotovoltaico de 5.5 kWp" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição detalhada da obra..." className="min-h-[80px]" />
            </div>

            {/* Location - Estado + Cidade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v, cidade: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {ESTADOS_BRASIL.map((e) => (
                      <SelectItem key={e.sigla} value={e.sigla}>{e.sigla} - {e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cidade *</Label>
                {cidades.length > 0 ? (
                  <Select value={form.cidade} onValueChange={(v) => setForm({ ...form, cidade: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder={cidadesLoading ? "Carregando..." : "Selecione a cidade"} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50 max-h-60">
                      {cidades.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder={cidadesLoading ? "Carregando cidades..." : "Digite a cidade"} />
                )}
              </div>
            </div>

            {/* Type and Client Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
                <Label>Nome do Cliente (manual)</Label>
                <Input value={form.cliente_nome} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} placeholder="Opcional" />
              </div>
            </div>

            {/* Link to Project / Client */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Vincular Projeto</Label>
                <Select value={form.projeto_id} onValueChange={(v) => setForm({ ...form, projeto_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.codigo} {p.potencia_kwp ? `(${p.potencia_kwp} kWp)` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Vincular Cliente</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} ({c.telefone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Technical Details Row 1 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>Potência (kWp)</Label>
                <Input type="number" step="0.01" value={form.potencia_kwp} onChange={(e) => setForm({ ...form, potencia_kwp: e.target.value })} placeholder="5.50" />
              </div>
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <CurrencyInput value={Number((form as any).valor_projeto) || 0} onChange={(v) => setForm({ ...form, valor_projeto: String(v) } as any)} />
              </div>
              <div className="space-y-2">
                <Label>Economia (R$/mês)</Label>
                <Input type="number" value={form.economia_mensal} onChange={(e) => setForm({ ...form, economia_mensal: e.target.value })} placeholder="680" />
              </div>
              <div className="space-y-2">
                <Label>Nº Módulos</Label>
                <Input type="number" value={form.numero_modulos} onChange={(e) => setForm({ ...form, numero_modulos: e.target.value })} placeholder="10" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modelo Inversor</Label>
                <Input value={form.modelo_inversor} onChange={(e) => setForm({ ...form, modelo_inversor: e.target.value })} placeholder="Growatt" />
              </div>
            </div>

            {/* Technical Details Row 2 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Tag className="w-3 h-3" /> Marca Painéis</Label>
                <Input value={form.marca_paineis} onChange={(e) => setForm({ ...form, marca_paineis: e.target.value })} placeholder="Canadian Solar" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Instalação (dias)</Label>
                <Input type="number" value={form.tempo_instalacao_dias} onChange={(e) => setForm({ ...form, tempo_instalacao_dias: e.target.value })} placeholder="2" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Payback (meses)</Label>
                <Input type="number" value={form.payback_meses} onChange={(e) => setForm({ ...form, payback_meses: e.target.value })} placeholder="48" />
              </div>
              <div className="space-y-2">
                <Label>Data Conclusão</Label>
                <DateInput value={form.data_conclusao} onChange={(v) => setForm({ ...form, data_conclusao: v })} />
              </div>
            </div>

            {/* Depoimento */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MessageSquareQuote className="w-4 h-4" /> Depoimento do Cliente</Label>
              <Textarea value={form.depoimento_cliente} onChange={(e) => setForm({ ...form, depoimento_cliente: e.target.value })} placeholder="&quot;Excelente trabalho, recomendo!&quot; — Nome do cliente" className="min-h-[60px]" />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Tag className="w-4 h-4" /> Tags</Label>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                      {tag}
                      <Button variant="ghost" size="icon" type="button" onClick={() => removeTag(tag)} className="hover:text-destructive ml-0.5 h-auto w-auto p-0">
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                  placeholder="Digite e pressione Enter..."
                  className="flex-1"
                />
                <Button type="button" variant="default" size="sm" onClick={() => addTag(tagInput)} disabled={!tagInput.trim()}>
                  Adicionar
                </Button>
              </div>
              {availableSuggestedTags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {availableSuggestedTags.map((tag) => (
                    <Button
                      key={tag}
                      type="button"
                      variant="outline"
                      onClick={() => addTag(tag)}
                      className="px-2 py-0.5 text-[10px] rounded-full h-auto"
                    >
                      + {tag}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Ordem */}
            <div className="w-32">
              <Label>Ordem de Exibição</Label>
              <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
            </div>

            {/* Video */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Video className="w-4 h-4" /> URL do Vídeo</Label>
              <Input value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> Imagens</Label>
              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={uploadingImages} />
                {uploadingImages ? (
                  <><Spinner size="sm" /> Enviando...</>
                ) : (
                  <><Upload className="w-5 h-5 text-muted-foreground" /> <span className="text-sm text-muted-foreground">Arraste ou clique para enviar imagens</span></>
                )}
              </label>

              {pendingImages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                  {pendingImages.map((url, idx) => (
                    <div key={idx} className={`relative group rounded-lg overflow-hidden aspect-square border-2 ${idx === 0 ? "border-primary" : "border-border"}`}>
                      <img src={url} alt={`Imagem ${idx + 1}`} className="w-full h-full object-cover" />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-6 h-6 rounded-full border-destructive text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity p-0">
                        <X className="w-3 h-3" />
                      </Button>
                      {idx !== 0 && (
                        <Button variant="ghost" type="button" onClick={() => setAsCover(idx)} className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-foreground/70 text-background text-[9px] rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-foreground/90 h-auto">
                          Definir capa
                        </Button>
                      )}
                      {idx === 0 && (
                        <Badge className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[9px]">★ Capa</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Switches */}
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch checked={form.destaque} onCheckedChange={(v) => setForm({ ...form, destaque: v })} />
                <Label className="text-sm">Destaque</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label className="text-sm">Visível no site</Label>
              </div>
            </div>
      </FormModalTemplate>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader><DialogTitle>Excluir Obra?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
