import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui-kit/Spinner";
import { FileText, Eye, Download, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getCurrentTenantId, tenantPath } from "@/lib/storagePaths";
import { useClienteProjectDocuments, type ClienteProjectDocument } from "@/hooks/useClienteDetail";
import { formatDate } from "@/lib/dateUtils";

type LegacyDocs = {
  identidade_urls: string[];
  comprovante_endereco_urls: string[];
  comprovante_beneficiaria_urls: string[];
};

type CategoryKey = "identidade" | "endereco" | "beneficiaria";

const CATEGORIES: { key: CategoryKey; label: string; legacyField: keyof LegacyDocs }[] = [
  { key: "identidade", label: "Identidade (RG/CNH)", legacyField: "identidade_urls" },
  { key: "endereco", label: "Comprovante de Endereço", legacyField: "comprovante_endereco_urls" },
  { key: "beneficiaria", label: "Comprovante Beneficiária", legacyField: "comprovante_beneficiaria_urls" },
];

function matchCategory(doc: ClienteProjectDocument): CategoryKey | null {
  const c = (doc.categoria || "").toLowerCase();
  const p = (doc.storage_path || "").toLowerCase();
  if (c.includes("identidade") || p.includes("identidade") || p.includes("/cap_identidade/")) return "identidade";
  if (c.includes("endere") || c === "comprovante de endereço" || p.includes("comprovante_endereco") || p.includes("/cap_comprovante_endereco/")) return "endereco";
  if (c.includes("beneficia") || p.includes("beneficia")) return "beneficiaria";
  return null;
}

async function signUrl(bucket: string, path: string, download = false): Promise<string | null> {
  const opts: any = download ? { download: true } : undefined;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600, opts);
  return data?.signedUrl || null;
}

interface DocItemProps {
  name: string;
  meta?: string;
  bucket: string;
  path: string;
  onRemove?: () => void;
}

function DocItem({ name, meta, bucket, path, onRemove }: DocItemProps) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isImage) {
      signUrl(bucket, path).then(setThumbUrl);
    }
  }, [bucket, path, isImage]);

  const handlePreview = async () => {
    const u = await signUrl(bucket, path);
    if (u) setPreviewUrl(u);
  };

  const handleDownload = async () => {
    const u = await signUrl(bucket, path, true);
    if (u) window.open(u, "_blank");
  };

  return (
    <>
      <div className="flex items-center gap-3 p-2 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors">
        <div className="w-10 h-10 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
          {isImage && thumbUrl ? (
            <img src={thumbUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <FileText className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          {meta && <p className="text-[11px] text-muted-foreground truncate">{meta}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handlePreview} title="Visualizar">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} title="Baixar">
            <Download className="h-3.5 w-3.5" />
          </Button>
          {onRemove && (
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove} title="Remover">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="w-[90vw] max-w-4xl max-h-[calc(100dvh-2rem)] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-sm truncate">{name}</DialogTitle>
          </DialogHeader>
          <div className="min-h-[400px] max-h-[75vh] overflow-auto bg-muted/50 flex items-center justify-center p-4">
            {previewUrl && isImage ? (
              <img src={previewUrl} alt={name} className="max-w-full max-h-full object-contain" />
            ) : previewUrl ? (
              <iframe src={previewUrl} title={name} className="w-full h-full min-h-[500px]" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ClienteDocsTabProps {
  clienteId: string;
  legacyDocs: LegacyDocs;
  onLegacyDocsChange: (updated: LegacyDocs) => void;
}

export function ClienteDocsTab({ clienteId, legacyDocs, onLegacyDocsChange }: ClienteDocsTabProps) {
  const { toast } = useToast();
  const { data: projectDocs = [], isLoading } = useClienteProjectDocuments(clienteId);
  const [uploadingField, setUploadingField] = useState<CategoryKey | null>(null);

  const grouped = useMemo(() => {
    const out: Record<CategoryKey, ClienteProjectDocument[]> = {
      identidade: [],
      endereco: [],
      beneficiaria: [],
    };
    for (const d of projectDocs) {
      const k = matchCategory(d);
      if (k) out[k].push(d);
    }
    return out;
  }, [projectDocs]);

  const categorizedIds = useMemo(() => {
    const s = new Set<string>();
    Object.values(grouped).forEach((arr) => arr.forEach((d) => s.add(d.id)));
    return s;
  }, [grouped]);

  const handleUpload = async (cat: CategoryKey, field: keyof LegacyDocs, files: FileList) => {
    setUploadingField(cat);
    try {
      const tid = await getCurrentTenantId();
      if (!tid) throw new Error("Tenant não encontrado");
      const uploadedPaths: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: "Arquivo muito grande", description: `${file.name} excede 10MB`, variant: "destructive" });
          continue;
        }
        const ext = file.name.split(".").pop();
        const fileName = tenantPath(tid, clienteId, field, `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`);
        const { error } = await supabase.storage.from("documentos-clientes").upload(fileName, file, { contentType: file.type });
        if (error) {
          toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
          continue;
        }
        uploadedPaths.push(fileName);
      }
      if (uploadedPaths.length > 0) {
        const newArr = [...(legacyDocs[field] || []), ...uploadedPaths];
        const updated = { ...legacyDocs, [field]: newArr };
        const { error: updateError } = await supabase
          .from("clientes")
          .update({ [field]: newArr })
          .eq("id", clienteId);
        if (updateError) throw updateError;
        onLegacyDocsChange(updated);
        toast({ title: `${uploadedPaths.length} arquivo(s) enviado(s)!` });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha no upload", variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  };

  const handleRemoveLegacy = async (field: keyof LegacyDocs, idx: number) => {
    const newArr = (legacyDocs[field] || []).filter((_, i) => i !== idx);
    const updated = { ...legacyDocs, [field]: newArr };
    const { error } = await supabase.from("clientes").update({ [field]: newArr }).eq("id", clienteId);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    onLegacyDocsChange(updated);
  };

  return (
    <div className="space-y-5">
      {CATEGORIES.map((cat) => {
        const fromProjects = grouped[cat.key];
        const legacyPaths = legacyDocs[cat.legacyField] || [];
        const isEmpty = fromProjects.length === 0 && legacyPaths.length === 0;
        return (
          <div key={cat.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">{cat.label}</h4>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) handleUpload(cat.key, cat.legacyField, e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="gap-1.5 pointer-events-none" disabled={uploadingField === cat.key}>
                  {uploadingField === cat.key ? <Spinner size="sm" /> : <Upload className="h-3 w-3" />}
                  Anexar
                </Button>
              </label>
            </div>
            {isLoading ? (
              <p className="text-xs text-muted-foreground italic">Carregando...</p>
            ) : isEmpty ? (
              <p className="text-xs text-muted-foreground italic">Nenhum documento anexado</p>
            ) : (
              <div className="space-y-1.5">
                {fromProjects.map((d) => (
                  <DocItem
                    key={d.id}
                    name={d.display_name || d.file_name || "Documento"}
                    meta={`Projeto • ${formatDate(d.created_at)}`}
                    bucket={d.bucket}
                    path={d.storage_path}
                  />
                ))}
                {legacyPaths.map((p, idx) => (
                  <DocItem
                    key={`legacy-${idx}`}
                    name={p.split("/").pop() || "Documento"}
                    meta="Cliente"
                    bucket="documentos-clientes"
                    path={p}
                    onRemove={() => handleRemoveLegacy(cat.legacyField, idx)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Outros documentos do cliente (sem categoria mapeada) */}
      {projectDocs.filter((d) => !categorizedIds.has(d.id)).length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <h4 className="text-sm font-medium text-foreground">Outros documentos</h4>
          <div className="space-y-1.5">
            {projectDocs
              .filter((d) => !categorizedIds.has(d.id))
              .map((d) => (
                <DocItem
                  key={d.id}
                  name={d.display_name || d.file_name || "Documento"}
                  meta={`${d.categoria || "Sem categoria"} • ${formatDate(d.created_at)}`}
                  bucket={d.bucket}
                  path={d.storage_path}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
