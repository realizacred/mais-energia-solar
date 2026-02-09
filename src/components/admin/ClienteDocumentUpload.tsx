import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId, tenantPath } from "@/lib/storagePaths";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Image,
  Upload,
  Loader2,
  Eye,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DocCategory = "identidade_urls" | "comprovante_endereco_urls" | "comprovante_beneficiaria_urls";

const DOC_CATEGORIES: { key: DocCategory; label: string }[] = [
  { key: "identidade_urls", label: "Identidade (RG/CNH)" },
  { key: "comprovante_endereco_urls", label: "Comprovante de Endereço" },
  { key: "comprovante_beneficiaria_urls", label: "Comprovante Beneficiária" },
];

function getSignedUrl(path: string): Promise<string | null> {
  return supabase.storage
    .from("documentos-clientes")
    .createSignedUrl(path, 3600)
    .then(({ data }) => data?.signedUrl || null);
}

function DocThumbnail({ path, onPreview, onRemove }: { path: string; onPreview: () => void; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);

  useState(() => {
    getSignedUrl(path).then((u) => { setUrl(u); setLoading(false); }).catch(() => setLoading(false));
  });

  if (loading) {
    return (
      <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onPreview}
        className="w-20 h-20 rounded-lg border-2 border-transparent hover:border-primary overflow-hidden transition-colors relative"
      >
        {isImage && url ? (
          <img src={url} alt="Documento" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-1">
            <FileText className="h-6 w-6 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">
              {path.split("/").pop()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        title="Remover"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

interface ClienteDocumentUploadProps {
  clienteId: string;
  documents: Record<DocCategory, string[]>;
  onDocumentsChange: (updated: Record<DocCategory, string[]>) => void;
}

export function ClienteDocumentUpload({ clienteId, documents, onDocumentsChange }: ClienteDocumentUploadProps) {
  const { toast } = useToast();
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLabel, setPreviewLabel] = useState("");

  const handleUpload = useCallback(async (field: DocCategory, files: FileList) => {
    setUploadingField(field);
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

        const { error } = await supabase.storage
          .from("documentos-clientes")
          .upload(fileName, file, { contentType: file.type });

        if (error) {
          toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
          continue;
        }

        uploadedPaths.push(fileName);
      }

      if (uploadedPaths.length > 0) {
        const newDocs = { ...documents, [field]: [...documents[field], ...uploadedPaths] };

        const { error: updateError } = await supabase
          .from("clientes")
          .update({ [field]: newDocs[field] })
          .eq("id", clienteId);

        if (updateError) throw updateError;

        onDocumentsChange(newDocs);
        toast({ title: `${uploadedPaths.length} arquivo(s) enviado(s)!` });
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Falha no upload", variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  }, [clienteId, documents, onDocumentsChange, toast]);

  const handleRemove = useCallback(async (field: DocCategory, index: number) => {
    const newPaths = documents[field].filter((_, i) => i !== index);
    const newDocs = { ...documents, [field]: newPaths };

    const { error } = await supabase
      .from("clientes")
      .update({ [field]: newPaths })
      .eq("id", clienteId);

    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }

    onDocumentsChange(newDocs);
  }, [clienteId, documents, onDocumentsChange, toast]);

  const handlePreview = async (path: string, label: string) => {
    const url = await getSignedUrl(path);
    if (url) {
      setPreviewUrl(url);
      setPreviewLabel(label);
      setPreviewOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      {DOC_CATEGORIES.map((cat) => {
        const paths = documents[cat.key] || [];
        return (
          <div key={cat.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">{cat.label}</h4>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleUpload(cat.key, e.target.files);
                    }
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 pointer-events-none"
                  disabled={uploadingField === cat.key}
                >
                  {uploadingField === cat.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  Anexar
                </Button>
              </label>
            </div>

            {paths.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {paths.map((path, idx) => (
                  <DocThumbnail
                    key={idx}
                    path={path}
                    onPreview={() => handlePreview(path, cat.label)}
                    onRemove={() => handleRemove(cat.key, idx)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nenhum documento anexado</p>
            )}
          </div>
        );
      })}

      {/* Full-screen preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="text-sm">{previewLabel}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-[400px] max-h-[75vh] overflow-auto bg-muted/50 flex items-center justify-center p-4">
            {previewUrl && /\.(jpg|jpeg|png|gif|webp)/i.test(previewUrl) ? (
              <img src={previewUrl} alt="Documento" className="max-w-full max-h-full object-contain" />
            ) : previewUrl ? (
              <iframe src={previewUrl} title="Documento" className="w-full h-full min-h-[500px]" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
