/**
 * Renderer reutilizável para campos customizados do tipo "file".
 * - Reusa bucket `projeto-documentos` (path: {tenant_id}/deals/{deal_id}/custom-fields/{field_key}/...)
 * - Persiste valor como JSON em value_text:
 *     { storage_path, filename, mime, size, uploaded_at }
 * - Download via signed URL (5 min).
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Download, X, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface CustomFieldFileMeta {
  storage_path: string;
  filename: string;
  mime?: string;
  size?: number;
  uploaded_at?: string;
}

export function parseFileMeta(value: unknown): CustomFieldFileMeta | null {
  if (!value) return null;
  if (typeof value === "object") return value as CustomFieldFileMeta;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && parsed.storage_path) {
      return parsed as CustomFieldFileMeta;
    }
  } catch {
    /* not JSON */
  }
  return null;
}

async function getTenantId(): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .limit(1)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");
  return (profile as any).tenant_id;
}

interface Props {
  /** JSON string (or already-parsed object) saved on value_text */
  value: unknown;
  fieldKey: string;
  /** When set, uploads under `{tenant}/deals/{dealId}/custom-fields/{fieldKey}/...` */
  dealId?: string | null;
  /** Called with the JSON string to persist (or null when removed) */
  onChange: (jsonValue: string | null, meta: CustomFieldFileMeta | null) => void | Promise<void>;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
}

export function CustomFieldFileInput({
  value,
  fieldKey,
  dealId,
  onChange,
  className,
  compact,
  disabled,
}: Props) {
  const meta = parseFileMeta(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const canUpload = !!dealId && !disabled;

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-pick same file
    if (!file || !dealId) return;
    setBusy(true);
    try {
      const tenantId = await getTenantId();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${tenantId}/deals/${dealId}/custom-fields/${fieldKey}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("projeto-documentos")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const newMeta: CustomFieldFileMeta = {
        storage_path: path,
        filename: file.name,
        mime: file.type || undefined,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      };
      await onChange(JSON.stringify(newMeta), newMeta);
      toast({ title: "Arquivo enviado" });
    } catch (err: any) {
      console.error("[CustomFieldFileInput] upload error:", err);
      toast({ title: "Erro ao enviar", description: err.message || String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    if (!meta?.storage_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("projeto-documentos")
        .createSignedUrl(meta.storage_path, 300);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast({ title: "Erro ao baixar", description: err.message || String(err), variant: "destructive" });
    }
  }

  async function handleRemove() {
    if (!meta?.storage_path) {
      await onChange(null, null);
      return;
    }
    setBusy(true);
    try {
      // Best-effort cleanup; even if storage delete fails, clear the value.
      await supabase.storage.from("projeto-documentos").remove([meta.storage_path]);
    } catch (err) {
      console.warn("[CustomFieldFileInput] remove storage error:", err);
    } finally {
      await onChange(null, null);
      setBusy(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5 min-w-0", className)}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleUpload}
        disabled={!canUpload || busy}
      />
      {meta ? (
        <>
          <button
            type="button"
            onClick={handleDownload}
            className={cn(
              "flex items-center gap-1.5 min-w-0 flex-1 text-xs px-2 py-1 rounded border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-foreground",
              compact && "h-7"
            )}
            title={meta.filename}
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate flex-1 text-left">{meta.filename}</span>
            <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleRemove}
            disabled={busy || disabled}
            title="Remover arquivo"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn("flex-1 justify-center gap-1.5 text-xs", compact && "h-8")}
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload || busy}
          title={canUpload ? "Anexar arquivo" : "Salve o registro antes de anexar"}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {busy ? "Enviando..." : canUpload ? "Anexar arquivo" : "Salve para anexar"}
        </Button>
      )}
    </div>
  );
}
