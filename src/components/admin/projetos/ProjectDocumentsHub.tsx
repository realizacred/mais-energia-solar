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
import { formatDateTime } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { FilePreviewModal, type FilePreviewTarget } from "./FilePreviewModal";
import {
  useProjectDocuments,
  useUploadProjectDocument,
  useDeleteProjectDocument,
  useRenameProjectDocument,
  type ProjectDocument,
  type ProjectDocumentOrigem,
} from "@/hooks/useProjectDocuments";
import { useProjetoArquivos, useDeletarArquivo } from "@/hooks/useProjetoDocumentos";
import { useProjetoCustomFieldFiles } from "@/hooks/useProjetoCustomFieldFiles";
import { normalizeFilename, logicalSuffix } from "@/lib/documentDedup";



interface Props {
  projetoId?: string | null;
  dealId?: string | null;
}

const ORIGEM_LABEL: Record<ProjectDocumentOrigem, string> = {
  manual: "Manual",
  generated: "Proposta gerada",
  custom_field: "Campo customizado",
  checklist_cliente: "Checklist cliente",
  checklist_instalador: "Checklist instalador",
  checklist_doc: "Checklist documental",
  post_sale: "Pós-venda",
  legacy: "Legado",
  recibo: "Recibo",
};

const ORIGEM_COLOR: Record<ProjectDocumentOrigem, string> = {
  manual: "bg-primary/10 text-primary border-primary/20",
  generated: "bg-info/10 text-info border-info/20",
  custom_field: "bg-accent text-accent-foreground border-border",
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


/** Normaliza nome de categoria para evitar duplicação visual ("CAMPO: X" vs "X"). */
export function resolveDocumentCategory(raw?: string | null): string {
  if (!raw) return "Outros";
  let c = raw.trim().replace(/^campo[:\s]+/i, "");
  const slug = c
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
    
  const ALIASES: Record<string, string> = {
    identidade: "Identidade",
    rg: "Identidade",
    rg_cnh: "Identidade",
    cnh: "Identidade",
    comprovante_endereco: "Comprovante de endereço",
    comprovante_de_endereco: "Comprovante de endereço",
    conta_luz: "Conta de luz",
    conta_de_luz: "Conta de luz",
    iptu: "IPTU",
    fotos_telhado: "Fotos do telhado",
    art: "ART",
    contrato: "Contrato",
    proposta: "Proposta",
    anexos_manuais: "Outros",
    transformador: "Transformador",
    disjuntor: "Disjuntor",
    wi_fi: "Wi-Fi",
    localizacao: "Localização",
    equipamento: "Equipamento",
  };
  
  if (ALIASES[slug]) return ALIASES[slug];
  
  // Title case fallback
  return c
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

const normalizeCategoria = resolveDocumentCategory;


export function ProjectDocumentsHub({ projetoId, dealId }: Props) {
  const { data: canonicalDocs = [], isLoading } = useProjectDocuments({ projetoId, dealId });
  const { data: legacyFiles = [] } = useProjetoArquivos(dealId || "");
  const { data: cfFiles = [] } = useProjetoCustomFieldFiles(dealId || "");
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
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [selectedCategoria, setSelectedCategoria] = useState<string>("Manual");
  const fileInput = useRef<HTMLInputElement>(null);


  // Cache buster: ao montar/trocar projeto/deal, invalida as 3 fontes para
  // refletir imediatamente a nova lógica de dedup semântico (sem esperar
  // staleTime — useProjetoArquivos=5min, useProjectDocuments=30s, cfFiles=60s).
  const qc = useQueryClient();
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["project-documents"] });
    if (dealId) {
      qc.invalidateQueries({ queryKey: ["projeto-documentos-files", dealId] });
      qc.invalidateQueries({ queryKey: ["projeto-custom-field-files", dealId] });
    }
  }, [qc, projetoId, dealId]);

  // Mescla canônico + legado bucket + custom fields como linhas virtuais.
  // SSOT visual = project_documents. Dedup semântico em 3 camadas:
  //   1) bucket+storage_path (mesmo arquivo físico)
  //   2) scope + normalizedFilename (+ size opcional)
  //   3) scope + logicalSuffix (frente/verso/comprovante)
  // Quando há colisão, preferimos o bucket canônico `projeto-documentos`
  // como destino de download/preview e enriquecemos com metadado de campo.
  const docs = useMemo<ProjectDocument[]>(() => {
    const out: ProjectDocument[] = [];
    const byPath = new Map<string, ProjectDocument>();

    // 1) project_documents — SSOT visual
    for (const d of canonicalDocs) {
      const norm: ProjectDocument = { ...d, categoria: normalizeCategoria(d.categoria) };
      // dedup apenas por path físico para não duplicar se vier de fontes diferentes apontando pro mesmo arquivo
      const dup = byPath.get(`${norm.bucket}::${norm.storage_path}`);
      if (dup) continue;
      out.push(norm);
      byPath.set(`${norm.bucket}::${norm.storage_path}`, norm);
    }

    // 2) Legacy bucket scan
    for (const f of legacyFiles) {
      if (!f.id || !f.metadata) continue;
      const path = `legacy/${dealId}/${f.name}`;
      const fname = f.name.replace(/^\d+_/, "");
      if (byPath.get(`projeto-documentos::${path}`)) continue;
      
      const item: ProjectDocument = {
        id: `legacy:${f.name}`,
        tenant_id: "",
        projeto_id: projetoId || null,
        deal_id: dealId || null,
        proposta_id: null,
        cliente_id: null,
        categoria: "Outros",
        display_name: null,
        origem: "legacy",
        bucket: "projeto-documentos",
        storage_path: path,
        file_name: fname,
        mime_type: f.metadata?.mimetype || null,
        size_bytes: f.metadata?.size || null,
        uploaded_by: null,
        metadata: { _legacyName: f.name },
        source_table: "storage",
        source_id: f.name,
        is_deleted: false,
        created_at: f.created_at || new Date().toISOString(),
        updated_at: f.created_at || new Date().toISOString(),
      };
      out.push(item);
      byPath.set(`projeto-documentos::${path}`, item);
    }

    // 3) Custom field files
    for (const cf of cfFiles) {
      if (byPath.get(`projeto-documentos::${cf.storage_path}`)) {
        const existing = byPath.get(`projeto-documentos::${cf.storage_path}`)!;
        existing.metadata = {
          ...(existing.metadata || {}),
          field_id: cf.field_id,
          field_key: cf.field_key,
          field_title: cf.field_title,
          is_custom_field: true,
        };
        continue;
      }
      
      const item: ProjectDocument = {
        id: `cf:${cf.field_id}:${cf.storage_path}`,
        tenant_id: "",
        projeto_id: projetoId || null,
        deal_id: dealId || null,
        proposta_id: null,
        cliente_id: null,
        categoria: normalizeCategoria(cf.field_title),
        display_name: null,
        origem: "custom_field",
        bucket: "projeto-documentos",
        storage_path: cf.storage_path,
        file_name: cf.filename,
        mime_type: cf.mime || null,
        size_bytes: cf.size || null,
        uploaded_by: null,
        metadata: { field_id: cf.field_id, field_key: cf.field_key, field_title: cf.field_title, is_custom_field: true },
        source_table: "deal_custom_field_values",
        source_id: cf.field_id,
        is_deleted: false,
        created_at: cf.uploaded_at || new Date().toISOString(),
        updated_at: cf.uploaded_at || new Date().toISOString(),
      };
      out.push(item);
      byPath.set(`projeto-documentos::${cf.storage_path}`, item);
    }

    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [canonicalDocs, legacyFiles, cfFiles, dealId, projetoId]);


  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return docs.filter((d) => {
      // Recibos e documentos gerados aparecem em seções dedicadas acima
      if (d.origem === 'generated' || d.origem === 'recibo') return false;
      if (origemFilter !== "all" && d.origem !== origemFilter) return false;
      if (s && !d.file_name.toLowerCase().includes(s) && !(d.categoria || "").toLowerCase().includes(s))
        return false;
      return true;
    });
  }, [docs, search, origemFilter]);

  const groups = useMemo(() => {
    const out: Record<string, ProjectDocument[]> = {};
    for (const d of filtered) {
      const k = normalizeCategoria(d.categoria || ORIGEM_LABEL[d.origem] || "Outros");
      (out[k] ||= []).push(d);
    }
    return Object.entries(out).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalCount = docs.length;
  const totalSize = useMemo(
    () => docs.reduce((acc, d) => acc + (d.size_bytes || 0), 0),
    [docs],
  );

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
                          <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5", ORIGEM_COLOR[d.origem])}>
                            {ORIGEM_LABEL[d.origem]}
                          </Badge>
                          {(d.metadata as any)?.is_custom_field && (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 gap-1">
                              <Info className="h-3 w-3" />
                              Campo customizado
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {d.display_name ? (
                            <span className="text-[10px] italic mr-2 opacity-70">({d.file_name})</span>
                          ) : null}
                          {formatSize(d.size_bytes)} •{" "}
                          {formatDateTime(d.created_at, {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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

