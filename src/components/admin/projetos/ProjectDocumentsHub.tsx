/**
 * ProjectDocumentsHub — Hub canônico SaaS premium de documentos do projeto.
 *
 * Lê APENAS de `project_documents` (SSOT). Inclui:
 * - drag/drop multi-upload com progresso
 * - filtros por origem/categoria + busca
 * - agrupamento por categoria
 * - cards com ícone por MIME, ações preview/download/excluir
 * - preview overlay (FilePreviewModal) — sem navegação full page
 * - EmptyState e Skeleton premium
 *
 * Adicional ao DocumentosTab existente — não substitui o legado nesta fase.
 */
import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Search,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Eye,
  Download,
  Trash2,
  MoreVertical,
  Loader2,
  Plus,
  Filter,
  Pencil,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FilePreviewModal, type FilePreviewTarget } from "./FilePreviewModal";
import {
  useProjectDocuments,
  useUploadProjectDocument,
  useDeleteProjectDocument,
  useRenameProjectDocument,
  useUpdateProjectDocumentCategory,
  type ProjectDocument,
  type ProjectDocumentOrigem,
} from "@/hooks/useProjectDocuments";

import { useDeletarArquivo } from "@/hooks/useProjetoDocumentos";
import { resolveDocumentCategory } from "@/lib/documentDedup";



interface Props {
  projetoId?: string | null;
  dealId?: string | null;
}

const ORIGEM_LABEL: Record<ProjectDocumentOrigem, string> = {
  manual: "Manual",
  generated: "Gerado",
  custom_field: "Campo customizado",
  checklist_cliente: "Checklist Cliente",
  checklist_instalador: "Checklist Instalador",
  checklist_doc: "Checklist Documental",
  post_sale: "Pós-Venda",
  legacy: "Legado",
  recibo: "Recibo",
};

const ORIGEM_COLOR: Record<ProjectDocumentOrigem, string> = {
  manual: "bg-primary/10 text-primary border-primary/20",
  generated: "bg-info/10 text-info border-info/20",
  custom_field: "bg-primary/10 text-primary border-primary/20",
  checklist_cliente: "bg-warning/10 text-warning border-warning/20",
  checklist_instalador: "bg-warning/10 text-warning border-warning/20",
  checklist_doc: "bg-success/10 text-success border-success/20",
  post_sale: "bg-secondary text-secondary-foreground border-border",
  legacy: "bg-muted text-muted-foreground border-border",
  recibo: "bg-success/10 text-success border-success/20",
};



function iconFor(mime?: string | null, name?: string) {
  const m = (mime || "").toLowerCase();
  const ext = (name || "").split(".").pop()?.toLowerCase() || "";
  if (m.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext))
    return FileImage;
  if (m === "application/pdf" || ext === "pdf") return FileText;
  if (m.includes("sheet") || ["xlsx", "xls", "csv"].includes(ext)) return FileSpreadsheet;
  if (["zip", "rar", "7z"].includes(ext)) return FileArchive;
  return FileIcon;
}

function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


const normalizeCategoria = resolveDocumentCategory;


export function ProjectDocumentsHub({ projetoId, dealId }: Props) {
  const { data: projectDocsData, isLoading } = useProjectDocuments({ projetoId, dealId });
  const docs = projectDocsData?.documents || [];
  
  // Bug fix: use the actual unique physical documents count from projectDocsData
  const totalCount = docs.length;
  const totalSize = projectDocsData?.totalSize || 0;



  
  const upload = useUploadProjectDocument();
  const remove = useDeleteProjectDocument();
  const removeLegacy = useDeletarArquivo(dealId || "");

  const [search, setSearch] = useState("");
  const [origemFilter, setOrigemFilter] = useState<string>("all");
  const [preview, setPreview] = useState<FilePreviewTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectDocument | null>(null);
  const [renamingDoc, setRenamingDoc] = useState<ProjectDocument | null>(null);
  const [newName, setNewName] = useState("");
  const renameMutation = useRenameProjectDocument();
  const updateCategoryMutation = useUpdateProjectDocumentCategory();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);

  const [selectedCategoria, setSelectedCategoria] = useState<string>("Manual");
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return docs.filter((d) => {
      if (d.origem === 'generated' || d.origem === 'recibo') return false;
      if (origemFilter !== "all" && d.origem !== origemFilter) return false;
      if (s && !d.file_name.toLowerCase().includes(s) && !(d.categoria || "").toLowerCase().includes(s))
        return false;
      return true;
    });
  }, [docs, search, origemFilter]);

  const groups = useMemo(() => {
    if (!projectDocsData?.groupedByCategory) return [];
    
    // Use the groupedByCategory from the hook, but filtered if search/origemFilter active
    const out: Record<string, ProjectDocument[]> = {};
    for (const d of filtered) {
      const k = resolveDocumentCategory(d);
      (out[k] ||= []).push(d);
    }
    return Object.entries(out).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, projectDocsData?.groupedByCategory]);



  // Deduplication logic is handled server-side in normalizeProjectDocuments 
  // so we use data.documents directly.


  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (!arr.length) return;
      setUploading((u) => [...u, ...arr.map((f) => f.name)]);
      try {
        // BUG-05: Validar categoria antes de salvar em desenvolvimento
        const VALID_CHECKLIST_CATS = ["rg_cnh", "conta_luz", "iptu", "fotos_telhado", "art", "contrato"];
        if (process.env.NODE_ENV === 'development' && selectedCategoria !== "Manual" && !VALID_CHECKLIST_CATS.includes(selectedCategoria)) {
          console.warn('Categoria não mapeada para checklist:', selectedCategoria);
        }

        await Promise.all(
          arr.map((file) =>
            upload
              .mutateAsync({ file, projetoId, dealId, categoria: selectedCategoria })
              .finally(() =>
                setUploading((u) => u.filter((n) => n !== file.name)),
              ),
          ),
        );
      } catch {
        /* toast já mostrado */
      }
    },
    [upload, projetoId, dealId],
  );

  const resolveStoragePath = async (d: ProjectDocument): Promise<string> => {
    if (d.id.startsWith("legacy:")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .limit(1)
        .single();
      const tenantId = (profile as any)?.tenant_id;
      const realName = (d.metadata as any)?._legacyName || d.file_name;
      return `${tenantId}/deals/${dealId}/${realName}`;
    }
    return d.storage_path;
  };

  const onPreview = async (d: ProjectDocument) => {
    const path = await resolveStoragePath(d);
    setPreview({
      bucket: d.bucket,
      storage_path: path,
      filename: d.file_name,
      mime: d.mime_type,
      size: d.size_bytes,
      origin_label: ORIGEM_LABEL[d.origem],
      uploaded_at: d.created_at,
    });
    if (!d.id.startsWith("legacy:") && !d.id.startsWith("cf:")) {
      await supabase.from("project_document_events" as any).insert({
        tenant_id: d.tenant_id,
        document_id: d.id,
        event: "preview",
      });
    }
  };

  const onDownload = async (d: ProjectDocument) => {
    const path = await resolveStoragePath(d);
    if (d.bucket === "external") {
      window.open(path, "_blank");
    } else {
      const { data, error } = await supabase.storage
        .from(d.bucket)
        .createSignedUrl(path, 300, { download: d.file_name });
      if (error || !data?.signedUrl) {
        toast({ title: "Erro ao baixar", description: error?.message, variant: "destructive" });
        return;
      }
      window.open(data.signedUrl, "_blank");
    }
    if (!d.id.startsWith("legacy:") && !d.id.startsWith("cf:")) {
      await supabase.from("project_document_events" as any).insert({
        tenant_id: d.tenant_id,
        document_id: d.id,
        event: "download",
      });
    }
  };

  const handleDelete = (d: ProjectDocument) => {
    if (d.id.startsWith("legacy:")) {
      const realName = (d.metadata as any)?._legacyName || d.file_name;
      removeLegacy.mutate(realName);
      setConfirmDelete(null);
      return;
    }
    remove.mutate(d);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Documentos do projeto</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hub canônico — {totalCount} {totalCount === 1 ? "arquivo" : "arquivos"} • {formatSize(totalSize)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Manual">Outros</SelectItem>
              <SelectItem value="rg_cnh">RG/CNH</SelectItem>
              <SelectItem value="conta_luz">Conta de Luz</SelectItem>
              <SelectItem value="iptu">IPTU</SelectItem>
              <SelectItem value="fotos_telhado">Fotos Telhado</SelectItem>
              <SelectItem value="art">ART</SelectItem>
              <SelectItem value="contrato">Contrato</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => fileInput.current?.click()} className="gap-1.5" disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Enviar
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou categoria..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={origemFilter} onValueChange={setOrigemFilter}>
          <SelectTrigger className="w-[200px] h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {Object.entries(ORIGEM_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border-dashed border-2 transition-colors p-6 text-center cursor-pointer bg-card",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        )}
        onClick={() => fileInput.current?.click()}
      >
        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">Arraste arquivos aqui ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground mt-1">Múltiplos arquivos suportados</p>
        {uploading.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
            {uploading.map((n) => (
              <Badge key={n} variant="outline" className="gap-1 text-[11px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                {n}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="grid gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center bg-card">
          <FileIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Nenhum documento encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || origemFilter !== "all"
              ? "Ajuste os filtros ou faça uma nova busca."
              : "Envie arquivos para começar a organizar a documentação do projeto."}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map(([categoria, items]) => (
            <div key={categoria}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {categoria}
                </h3>
                <span className="text-[11px] text-muted-foreground">({items.length})</span>
              </div>
              <div className="grid gap-2">
                {items.map((d) => {
                  const Icon = iconFor(d.mime_type, d.file_name);
                  return (
                    <Card
                      key={d.id}
                      className="flex items-center gap-3 p-3 bg-card hover:border-primary/40 transition-colors border-l-4 border-l-primary/30"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">
                            {d.display_name || d.file_name}
                          </p>
                          {d.origem !== 'manual' && (
                            <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5", ORIGEM_COLOR[d.origem])}>
                              {ORIGEM_LABEL[d.origem]}
                            </Badge>
                          )}

                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {d.display_name ? (
                            <span className="text-[10px] italic mr-2 opacity-70">({d.file_name})</span>
                          ) : null}
                          {formatSize(d.size_bytes)} •{" "}
                          {formatDateTime(d.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => onPreview(d)} className="h-8 w-8 p-0">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDownload(d)} className="h-8 w-8 p-0">
                          <Download className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setRenamingDoc(d);
                                setNewName(d.display_name || d.file_name.split('.').slice(0, -1).join('.'));
                              }}
                              disabled={d.id.startsWith("legacy:") || d.id.startsWith("cf:")}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Renomear
                            </DropdownMenuItem>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Filter className="h-3.5 w-3.5 mr-2" />
                                  Alterar categoria
                                </DropdownMenuItem>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="left">
                                <DropdownMenuItem onClick={() => updateCategoryMutation.mutate({ docId: d.id, newCategory: "Identidade" })}>Identidade</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateCategoryMutation.mutate({ docId: d.id, newCategory: "Comprovante de endereço" })}>Comprovante de endereço</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateCategoryMutation.mutate({ docId: d.id, newCategory: "Conta de luz" })}>Conta de luz</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateCategoryMutation.mutate({ docId: d.id, newCategory: "IPTU" })}>IPTU</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => updateCategoryMutation.mutate({ docId: d.id, newCategory: "Outros" })}>Outros</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmDelete(d)}
                              disabled={d.origem !== "manual" && d.origem !== "legacy"}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <FilePreviewModal target={preview} onClose={() => setPreview(null)} />

      <Dialog open={!!renamingDoc} onOpenChange={(o) => !o && setRenamingDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome original</Label>
              <Input value={renamingDoc?.file_name || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Novo nome</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Comprovante de Endereço - Luiz Alberto"
                maxLength={120}
                autoFocus
              />
              <p className="text-[10px] text-muted-foreground">
                A extensão do arquivo será preservada automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingDoc(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!renamingDoc || !newName.trim()) return;
                const ext = renamingDoc.file_name.split('.').pop();
                const finalName = `${newName.trim()}.${ext}`;
                await renameMutation.mutateAsync({ docId: renamingDoc.id, newName: finalName });
                setRenamingDoc(null);
              }}
              disabled={renameMutation.isPending || !newName.trim()}
            >
              {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.display_name || confirmDelete?.file_name}" será removido permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) handleDelete(confirmDelete);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

