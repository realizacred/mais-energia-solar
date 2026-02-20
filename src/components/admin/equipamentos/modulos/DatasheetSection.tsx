import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Upload, Loader2, Sparkles, ExternalLink, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  moduloId?: string;
  datasheetUrl: string | null;
  datasheetSourceUrl: string | null;
  datasheetFoundAt: string | null;
  fabricante: string;
  modelo: string;
  onExtracted: (data: Record<string, unknown>) => void;
  onDatasheetUploaded: (url: string) => void;
}

export function DatasheetSection({
  moduloId, datasheetUrl, datasheetSourceUrl, datasheetFoundAt,
  fabricante, modelo, onExtracted, onDatasheetUploaded,
}: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Apenas PDFs são aceitos", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande (máx 10MB)", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // Upload to storage
      const path = `datasheets/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("module-datasheets")
        .upload(path, file, { contentType: "application/pdf" });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("module-datasheets")
        .getPublicUrl(path);

      onDatasheetUploaded(urlData.publicUrl);
      toast({ title: "Datasheet anexado com sucesso" });

      // Auto-extract
      await extractFromFile(file);
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const extractFromFile = async (file: File) => {
    setExtracting(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const { data, error } = await supabase.functions.invoke("extract-module-pdf", {
        body: { pdf_base64: base64, fabricante, modelo },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Extração falhou");

      onExtracted(data.data);
      toast({
        title: "Dados extraídos do datasheet",
        description: `${Object.keys(data.data).filter(k => data.data[k] != null).length} campos preenchidos automaticamente`,
      });
    } catch (err: any) {
      toast({
        title: "Não foi possível extrair dados",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="space-y-3">
      {datasheetUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <a href={datasheetUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium hover:underline truncate block">
                Datasheet PDF
              </a>
              {datasheetSourceUrl && (
                <a href={datasheetSourceUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:underline">
                  <ExternalLink className="w-3 h-3" /> Fonte original
                </a>
              )}
              {datasheetFoundAt && (
                <p className="text-xs text-muted-foreground">
                  Anexado em {new Date(datasheetFoundAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1"
              onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-3 h-3" /> Substituir
            </Button>
            {!extracting && (
              <Button type="button" variant="outline" size="sm" className="gap-1"
                onClick={async () => {
                  // Re-extract from existing URL
                  try {
                    setExtracting(true);
                    const resp = await fetch(datasheetUrl);
                    const blob = await resp.blob();
                    const file = new File([blob], "datasheet.pdf", { type: "application/pdf" });
                    await extractFromFile(file);
                  } catch (err: any) {
                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                    setExtracting(false);
                  }
                }}>
                <Sparkles className="w-3 h-3" /> Re-extrair dados
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/10">
          <FileText className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground text-center">
            Sem datasheet anexado. Anexe um PDF para preencher os campos automaticamente.
          </p>
          <Button type="button" variant="outline" size="sm" className="gap-2"
            onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Enviando..." : "Anexar Datasheet (PDF)"}
          </Button>
        </div>
      )}

      {extracting && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-primary">Extraindo dados do PDF com IA...</span>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
    </div>
  );
}
