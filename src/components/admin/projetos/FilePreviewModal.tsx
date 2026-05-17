/**
 * Modal universal de preview de arquivo.
 * - PDF: iframe
 * - imagem: <img>
 * - outros: card com download
 *
 * Usa signed URL temporária (1h) — nunca URL pública permanente.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/dateUtils";

export interface FilePreviewTarget {
  bucket: string;
  storage_path: string;
  filename: string;
  mime?: string | null;
  size?: number | null;
  origin_label?: string | null;
  uploaded_at?: string | null;
}

interface Props {
  target: FilePreviewTarget | null;
  onClose: () => void;
}

function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferKind(filename: string, mime?: string | null): "image" | "pdf" | "other" {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export function FilePreviewModal({ target, onClose }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!target) {
      setSignedUrl(null);
      setErrorState(null);
      return;
    }
    setLoading(true);
    setSignedUrl(null);
    setErrorState(null);

    const timer = setTimeout(() => {
      if (!cancelled && loading) {
        setLoading(false);
        setErrorState("Tempo limite de carregamento excedido (10s)");
      }
    }, 10000);

    const checkAndSign = async () => {
      try {
        if (target.bucket === "external") {
          if (cancelled) return;
          setSignedUrl(target.storage_path);
          return;
        }
        
        const { data, error } = await supabase.storage
          .from(target.bucket)
          .createSignedUrl(target.storage_path, 3600);

        if (cancelled) return;
        
        if (error) {
          if (error.message === "Object not found") {
            setErrorState("Arquivo não encontrado no servidor");
          } else {
            throw error;
          }
          return;
        }

        if (!data?.signedUrl) {
          throw new Error("Não foi possível gerar URL de visualização");
        }
        
        setSignedUrl(data.signedUrl);
      } catch (err: any) {
        if (cancelled) return;
        setErrorState(err.message || "Erro desconhecido ao carregar arquivo");
        toast({
          title: "Erro ao abrir arquivo",
          description: err.message === "Object not found" ? "Arquivo não encontrado no servidor." : err.message,
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
        clearTimeout(timer);
      }
    };

    checkAndSign();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [target]);

  const handleDownload = async () => {
    if (!target) return;
    try {
      if (target.bucket === "external") {
        window.open(target.storage_path, "_blank");
        return;
      }
      const { data, error } = await supabase.storage
        .from(target.bucket)
        .createSignedUrl(target.storage_path, 300, { download: target.filename });
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast({ title: "Erro ao baixar", description: err.message, variant: "destructive" });
    }
  };

  const kind = target ? inferKind(target.filename, target.mime) : "other";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-sm font-semibold text-foreground truncate">
              {target?.filename || "Arquivo"}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
              {target?.origin_label && <span>{target.origin_label} • </span>}
              {formatSize(target?.size)}
              {target?.uploaded_at && (
                <span> • {formatDateTime(target.uploaded_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </DialogDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Baixar
          </Button>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30 overflow-auto">
          {loading || !signedUrl ? (
            <div className="flex items-center justify-center h-[60vh]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : kind === "pdf" ? (
            <iframe src={signedUrl} className="w-full h-[75vh] border-0" title={target?.filename} />
          ) : kind === "image" ? (
            <div className="flex items-center justify-center p-4 min-h-[40vh]">
              <img src={signedUrl} alt={target?.filename} className="max-w-full max-h-[75vh] object-contain rounded" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Pré-visualização não suportada</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Tipo {target?.mime || target?.filename.split(".").pop()?.toUpperCase() || "desconhecido"} não pode ser exibido aqui.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleDownload} className="gap-1.5">
                  <Download className="h-4 w-4" />
                  Baixar arquivo
                </Button>
                <Button variant="outline" onClick={() => signedUrl && window.open(signedUrl, "_blank")} className="gap-1.5">
                  <ExternalLink className="h-4 w-4" />
                  Abrir em nova aba
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
