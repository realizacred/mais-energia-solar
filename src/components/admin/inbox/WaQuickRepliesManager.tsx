import { useState } from "react";
import { Plus, Trash2, Pencil, Zap, Image, FileText, Video, Music, GripVertical } from "lucide-react";
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

const EMPTY_FORM: QuickReplyForm = {
  titulo: "",
  conteudo: "",
  emoji: "💬",
  categoria: "geral",
  media_type: "",
};

const EMOJI_OPTIONS = ["💬", "👋", "📋", "🔄", "🙏", "🔧", "💰", "📊", "⚡", "🏠", "📱", "🎉", "⭐", "📦", "🚀"];

const CATEGORIAS = [
  { value: "geral", label: "Geral" },
  { value: "saudacao", label: "Saudação" },
  { value: "orcamento", label: "Orçamento" },
  { value: "followup", label: "Follow-up" },
  { value: "financiamento", label: "Financiamento" },
  { value: "tecnico", label: "Técnico" },
  { value: "encerramento", label: "Encerramento" },
];

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
        media_type: reply.media_type || "",
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
      media_url: form.media_type ? mediaUrl : null,
      media_type: form.media_type || null,
      media_filename: form.media_type ? mediaFilename : null,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Respostas Rápidas
          </CardTitle>
          <CardDescription className="mt-1">
            Crie mensagens pré-definidas com texto, imagens, vídeos, áudio e documentos para uso na central de atendimento.
          </CardDescription>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Resposta
        </Button>
      </CardHeader>
      <CardContent>
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
                        <Badge variant="outline" className="text-xs capitalize">
                          {CATEGORIAS.find(c => c.value === r.categoria)?.label || r.categoria}
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

        {/* Add/Edit Dialog */}
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
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Conteúdo da mensagem *</Label>
                <Textarea
                  value={form.conteudo}
                  onChange={(e) => setForm(p => ({ ...p, conteudo: e.target.value }))}
                  placeholder="Olá! Como posso ajudar?"
                  rows={4}
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Use *negrito*, _itálico_ e ~tachado~ para formatação WhatsApp.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Mídia (opcional)</Label>
                <Select
                  value={form.media_type}
                  onValueChange={(v) => setForm(p => ({ ...p, media_type: v === "none" ? "" : v }))}
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
                {form.media_type && (
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

        {/* Delete Dialog */}
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
