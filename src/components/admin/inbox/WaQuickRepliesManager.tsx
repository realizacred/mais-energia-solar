import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, Pencil, Zap, Image, FileText, Video, Music, GripVertical, Tag, Palette, Bold, Italic, Strikethrough, Code, List } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface QuickReply {
  id: string;
  titulo: string;
  conteudo: string;
  emoji: string | null;
  categoria: string | null;
  media_url: string | null;
  media_type: string | null;
  media_filename: string | null;
  ordem: number;
  ativo: boolean;
}

interface QuickReplyForm {
  titulo: string;
  conteudo: string;
  emoji: string;
  categoria: string;
  media_type: string;
}

interface QRCategory {
  id: string;
  nome: string;
  slug: string;
  cor: string;
  emoji: string | null;
  ordem: number;
  ativo: boolean;
}

const EMPTY_FORM: QuickReplyForm = {
  titulo: "",
  conteudo: "",
  emoji: "💬",
  categoria: "geral",
  media_type: "none",
};

const EMOJI_OPTIONS = ["💬", "👋", "📋", "🔄", "🙏", "🔧", "💰", "📊", "⚡", "🏠", "📱", "🎉", "⭐", "📦", "🚀"];

const COLOR_OPTIONS = [
  { value: "bg-muted text-muted-foreground", label: "Cinza" },
  { value: "bg-success/10 text-success", label: "Verde" },
  { value: "bg-primary/10 text-primary", label: "Azul" },
  { value: "bg-warning/10 text-warning", label: "Amarelo" },
  { value: "bg-info/10 text-info", label: "Ciano" },
  { value: "bg-accent text-accent-foreground", label: "Accent" },
  { value: "bg-destructive/10 text-destructive", label: "Vermelho" },
  { value: "bg-secondary/10 text-secondary", label: "Secundário" },
];

// ── Hook: Fetch categories ──
function useQRCategories() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["wa-qr-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_quick_reply_categories")
        .select("*")
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return data as QRCategory[];
    },
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (cat: Partial<QRCategory> & { id?: string }) => {
      if (cat.id) {
        const { error } = await supabase
          .from("wa_quick_reply_categories")
          .update({ nome: cat.nome, slug: cat.slug, cor: cat.cor, emoji: cat.emoji, ordem: cat.ordem, ativo: cat.ativo })
          .eq("id", cat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wa_quick_reply_categories")
          .insert({ nome: cat.nome!, slug: cat.slug!, cor: cat.cor!, emoji: cat.emoji, ordem: cat.ordem || 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-qr-categories"] });
      toast({ title: "Categoria salva" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar categoria", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wa_quick_reply_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-qr-categories"] });
      toast({ title: "Categoria excluída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  return {
    categories: query.data || [],
    loading: query.isLoading,
    saveCategory: saveMutation.mutate,
    deleteCategory: deleteMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}

const MEDIA_TYPE_ICON: Record<string, typeof Image> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
};

export function WaQuickRepliesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [deleting, setDeleting] = useState<QuickReply | null>(null);
  const [form, setForm] = useState<QuickReplyForm>(EMPTY_FORM);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Category management
  const { categories, loading: catsLoading, saveCategory, deleteCategory, isSaving: catSaving } = useQRCategories();
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<QRCategory | null>(null);
  const [deletingCat, setDeletingCat] = useState<QRCategory | null>(null);
  const [catForm, setCatForm] = useState({ nome: "", slug: "", cor: COLOR_OPTIONS[0].value, emoji: "💬", ordem: 0 });

  const { data: replies = [], isLoading } = useQuery({
    queryKey: ["wa-quick-replies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_quick_replies")
        .select("*")
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return data as QuickReply[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editing) {
        const { error } = await supabase
          .from("wa_quick_replies")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wa_quick_replies")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-quick-replies"] });
      toast({ title: editing ? "Resposta rápida atualizada" : "Resposta rápida criada" });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wa_quick_replies")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-quick-replies"] });
      toast({ title: "Resposta rápida excluída" });
      setDeleting(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("wa_quick_replies")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-quick-replies"] });
    },
  });

  const openDialog = (reply?: QuickReply) => {
    if (reply) {
      setEditing(reply);
      setForm({
        titulo: reply.titulo,
        conteudo: reply.conteudo,
        emoji: reply.emoji || "💬",
        categoria: reply.categoria || "geral",
        media_type: reply.media_type || "none",
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setMediaFile(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }

    let mediaUrl = editing?.media_url || null;
    let mediaFilename = editing?.media_filename || null;

    // Upload media if selected
    if (mediaFile) {
      setUploading(true);
      try {
        const ext = mediaFile.name.split(".").pop() || "bin";
        const filePath = `quick-replies/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("wa-attachments")
          .upload(filePath, mediaFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("wa-attachments")
          .getPublicUrl(filePath);
        mediaUrl = urlData.publicUrl;
        mediaFilename = mediaFile.name;
      } catch (err: any) {
        toast({ title: "Erro ao enviar arquivo", description: err.message, variant: "destructive" });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    saveMutation.mutate({
      titulo: form.titulo.trim(),
      conteudo: form.conteudo.trim(),
      emoji: form.emoji,
      categoria: form.categoria,
      media_url: form.media_type && form.media_type !== "none" ? mediaUrl : null,
      media_type: form.media_type && form.media_type !== "none" ? form.media_type : null,
      media_filename: form.media_type && form.media_type !== "none" ? mediaFilename : null,
    });
  };

  // ── Text formatting helpers (hooks must be before any conditional returns) ──
  const wrapContentSelection = useCallback(
    (prefix: string, suffix?: string) => {
      const textarea = contentRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form.conteudo;
      const selected = text.substring(start, end);
      const s = suffix || prefix;
      const newText = text.substring(0, start) + prefix + selected + s + text.substring(end);
      setForm(p => ({ ...p, conteudo: newText }));
      setTimeout(() => {
        textarea.focus();
        const newCursor = selected
          ? start + prefix.length + selected.length + s.length
          : start + prefix.length;
        textarea.setSelectionRange(
          selected ? start : start + prefix.length,
          selected ? newCursor : start + prefix.length
        );
      }, 0);
    },
    [form.conteudo]
  );

  const insertBulletList = useCallback(() => {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const text = form.conteudo;
    const selected = text.substring(start, textarea.selectionEnd);
    const bullets = selected
      ? selected.split("\n").map(line => `• ${line}`).join("\n")
      : "• ";
    const newText = text.substring(0, start) + bullets + text.substring(textarea.selectionEnd);
    setForm(p => ({ ...p, conteudo: newText }));
    setTimeout(() => {
      textarea.focus();
      const pos = start + bullets.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  }, [form.conteudo]);

  // ── Non-hook helpers ──
  const openCatDialog = (cat?: QRCategory) => {
    if (cat) {
      setEditingCat(cat);
      setCatForm({ nome: cat.nome, slug: cat.slug, cor: cat.cor, emoji: cat.emoji || "💬", ordem: cat.ordem });
    } else {
      setEditingCat(null);
      setCatForm({ nome: "", slug: "", cor: COLOR_OPTIONS[0].value, emoji: "💬", ordem: categories.length });
    }
    setCatDialogOpen(true);
  };

  const handleSaveCat = () => {
    if (!catForm.nome.trim()) {
      toast({ title: "Preencha o nome da categoria", variant: "destructive" });
      return;
    }
    const slug = catForm.slug.trim() || catForm.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    saveCategory({
      ...(editingCat ? { id: editingCat.id } : {}),
      nome: catForm.nome.trim(),
      slug,
      cor: catForm.cor,
      emoji: catForm.emoji,
      ordem: catForm.ordem,
      ativo: true,
    });
    setCatDialogOpen(false);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Respostas Rápidas
        </CardTitle>
        <CardDescription className="mt-1">
          Gerencie mensagens e categorias para uso na central de atendimento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="respostas" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="respostas" className="gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Respostas
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Categorias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="respostas">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Resposta
              </Button>
            </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Mídia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {replies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma resposta rápida cadastrada. Clique em "Nova Resposta" para começar.
                  </TableCell>
                </TableRow>
              ) : (
                replies.map((r, idx) => {
                  const MediaIcon = r.media_type ? MEDIA_TYPE_ICON[r.media_type] : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{r.emoji || "💬"}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.titulo}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{r.conteudo}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${categories.find(c => c.slug === r.categoria)?.cor || ''}`}>
                          {categories.find(c => c.slug === r.categoria)?.nome || r.categoria || "Geral"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {MediaIcon ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MediaIcon className="w-3.5 h-3.5" />
                            <span className="capitalize">{r.media_type}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Texto</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={r.ativo}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, ativo: v })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(r)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleting(r)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
          </TabsContent>

          {/* ── Categories Tab ── */}
          <TabsContent value="categorias">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openCatDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Categoria
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma categoria cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((cat, idx) => (
                      <TableRow key={cat.id}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-base">{cat.emoji || "💬"}</span>
                            <span className="text-sm font-medium">{cat.nome}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{cat.slug}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs border-0 ${cat.cor}`}>
                            {cat.nome}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={cat.ativo}
                            onCheckedChange={(v) => saveCategory({ id: cat.id, nome: cat.nome, slug: cat.slug, cor: cat.cor, emoji: cat.emoji, ordem: cat.ordem, ativo: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openCatDialog(cat)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setDeletingCat(cat)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Category Add/Edit Dialog */}
            <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    {editingCat ? "Editar Categoria" : "Nova Categoria"}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
                    <div className="space-y-1">
                      <Label className="text-xs">Emoji</Label>
                      <Select value={catForm.emoji} onValueChange={(v) => setCatForm(p => ({ ...p, emoji: v }))}>
                        <SelectTrigger className="w-16 h-9 text-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EMOJI_OPTIONS.map(e => (
                            <SelectItem key={e} value={e}><span className="text-lg">{e}</span></SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Nome *</Label>
                      <Input
                        value={catForm.nome}
                        onChange={(e) => setCatForm(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Ex: Pós-venda"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Cor</Label>
                    <Select value={catForm.cor} onValueChange={(v) => setCatForm(p => ({ ...p, cor: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            <span className="flex items-center gap-2">
                              <span className={`inline-block w-3 h-3 rounded-full ${c.value.split(' ')[0]}`} />
                              {c.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label>Ordem</Label>
                    <Input
                      type="number"
                      value={catForm.ordem}
                      onChange={(e) => setCatForm(p => ({ ...p, ordem: parseInt(e.target.value) || 0 }))}
                      min={0}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSaveCat} disabled={catSaving}>
                    {catSaving ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Category Delete Dialog */}
            <AlertDialog open={!!deletingCat} onOpenChange={(v) => !v && setDeletingCat(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir Categoria</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deseja excluir a categoria "{deletingCat?.nome}"? Respostas rápidas com essa categoria ficarão sem categoria.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deletingCat && deleteCategory(deletingCat.id)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>
        </Tabs>

        {/* ── Respostas: Add/Edit Dialog ── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                {editing ? "Editar Resposta Rápida" : "Nova Resposta Rápida"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
                <div className="space-y-1">
                  <Label className="text-xs">Emoji</Label>
                  <Select value={form.emoji} onValueChange={(v) => setForm(p => ({ ...p, emoji: v }))}>
                    <SelectTrigger className="w-16 h-9 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMOJI_OPTIONS.map(e => (
                        <SelectItem key={e} value={e}><span className="text-lg">{e}</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Título *</Label>
                  <Input
                    value={form.titulo}
                    onChange={(e) => setForm(p => ({ ...p, titulo: e.target.value }))}
                    placeholder="Ex: Saudação inicial"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm(p => ({ ...p, categoria: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.ativo).map(c => (
                      <SelectItem key={c.slug} value={c.slug}>
                        <span className="flex items-center gap-2">
                          <span>{c.emoji || "💬"}</span>
                          {c.nome}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Conteúdo da mensagem *</Label>
                {/* WhatsApp formatting toolbar */}
                <div className="flex items-center gap-0.5 border border-border rounded-t-lg px-2 py-1 bg-muted/30">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrapContentSelection("*")}>
                        <Bold className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Negrito *texto*</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrapContentSelection("_")}>
                        <Italic className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Itálico _texto_</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrapContentSelection("~")}>
                        <Strikethrough className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Tachado ~texto~</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => wrapContentSelection("```\n", "\n```")}>
                        <Code className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Monospace ```texto```</TooltipContent>
                  </Tooltip>
                  <div className="w-px h-4 bg-border/50 mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={insertBulletList}>
                        <List className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Lista com bullets</TooltipContent>
                  </Tooltip>
                </div>
                <Textarea
                  ref={contentRef}
                  value={form.conteudo}
                  onChange={(e) => setForm(p => ({ ...p, conteudo: e.target.value }))}
                  placeholder="Olá! Como posso ajudar?"
                  rows={5}
                  className="text-sm rounded-t-none border-t-0 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Selecione texto e clique nos botões acima para formatar. Suporta formatação WhatsApp.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Mídia (opcional)</Label>
                <Select
                  value={form.media_type}
                  onValueChange={(v) => setForm(p => ({ ...p, media_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem mídia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem mídia</SelectItem>
                    <SelectItem value="image">📷 Imagem</SelectItem>
                    <SelectItem value="video">🎥 Vídeo</SelectItem>
                    <SelectItem value="audio">🎵 Áudio</SelectItem>
                    <SelectItem value="document">📄 Documento</SelectItem>
                  </SelectContent>
                </Select>
                {form.media_type && form.media_type !== "none" && (
                  <div className="space-y-1">
                    <Input
                      type="file"
                      accept={
                        form.media_type === "image" ? "image/*" :
                        form.media_type === "video" ? "video/*" :
                        form.media_type === "audio" ? "audio/*" :
                        ".pdf,.doc,.docx,.xls,.xlsx,.txt"
                      }
                      onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                    />
                    {editing?.media_url && !mediaFile && (
                      <p className="text-[10px] text-muted-foreground">
                        Arquivo atual: {editing.media_filename || "arquivo"} — selecione outro para substituir
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending || uploading}>
                {saveMutation.isPending || uploading ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Respostas: Delete Dialog */}
        <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Resposta Rápida</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja excluir "{deleting?.titulo}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleting && deleteMutation.mutate(deleting.id)}
                className="bg-destructive hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
