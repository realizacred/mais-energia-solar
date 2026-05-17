/**
 * Renderer reutilizável para campos customizados do tipo "file".
 * - Bucket: `projeto-documentos`
 * - Path: `{tenant_id}/deals/{deal_id}/custom-fields/{field_key}/{ts}_{name}`
 * - Persistência em `value_text` (JSON):
 *     - LEGADO: objeto único `{ storage_path, filename, mime, size, uploaded_at }`
 *     - NOVO:   array `[ { ... }, { ... } ]`
 * - Leitura sempre normaliza para array (retrocompat).
 * - Preview via FilePreviewModal (signed URL).
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, Upload, Eye, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FilePreviewModal, type FilePreviewTarget } from "./FilePreviewModal";
import { logUploadDiagnostics } from "@/lib/projectUploadDiagnostics";

export interface CustomFieldFileMeta {
  storage_path: string;
  filename: string;
  mime?: string;
  size?: number;
  uploaded_at?: string;
  uploaded_by?: string;
}

/**
 * Sempre retorna array.
 * Aceita: null/undefined, objeto único (legado), array, string JSON.
 */
export function parseFileMetaArray(value: unknown): CustomFieldFileMeta[] {
  if (!value) return [];
  let parsed: any = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.filter((m) => m && typeof m === "object" && m.storage_path);
  }
  if (parsed && typeof parsed === "object" && parsed.storage_path) {
    return [parsed as CustomFieldFileMeta];
  }
  return [];
}

/** @deprecated use parseFileMetaArray. Mantido para retrocompat de imports. */
export function parseFileMeta(value: unknown): CustomFieldFileMeta | null {
  return parseFileMetaArray(value)[0] || null;
}

async function getTenantId(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("Sessão expirada — faça login novamente");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao resolver tenant: ${error.message}`);
  const tenantId = (profile as any)?.tenant_id;
  if (!tenantId) throw new Error("Perfil sem tenant — contate o administrador");
  return tenantId;
}

interface Props {
  /** JSON (string ou já parseado), objeto ou array */
  value: unknown;
  fieldKey: string;
  dealId?: string | null;
  /** Recebe a string JSON a persistir (ou null quando vazio) e o array de meta atual */
  onChange: (jsonValue: string | null, metaList: CustomFieldFileMeta[]) => void | Promise<void>;
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
  const items = parseFileMetaArray(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const [preview, setPreview] = useState<FilePreviewTarget | null>(null);

  const canUpload = !!dealId && !disabled;

  async function persist(next: CustomFieldFileMeta[]) {
    const json = next.length === 0 ? null : JSON.stringify(next);
    await onChange(json, next);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0 || !dealId) {
      e.target.value = "";
      return;
    }
    setBusy(true);
    let tenantId: string | null = null;
    let currentPath: string | null = null;
    let currentFile: File | null = null;
    try {
      tenantId = await getTenantId();
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const uploaded: CustomFieldFileMeta[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        currentFile = file;
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${tenantId}/deals/${dealId}/custom-fields/${fieldKey}/${Date.now()}_${i}_${safeName}`;
        currentPath = path;
        const { error } = await supabase.storage
          .from("projeto-documentos")
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (error) throw error;
        uploaded.push({
          storage_path: path,
          filename: file.name,
          mime: file.type || undefined,
          size: file.size,
          uploaded_at: new Date().toISOString(),
          uploaded_by: userId,
        });
      }
      await persist([...items, ...uploaded]);
      
      // Se houver dealId, invalida o detalhe do projeto para refletir automações via trigger do banco
      if (dealId) {
        const qc = (window as any).queryClient;
        if (qc) {
          qc.invalidateQueries({ queryKey: ["projeto-detalhe", dealId] });
          qc.invalidateQueries({ queryKey: ["project-documents", null, dealId] });
        }
      }

      toast({ title: uploaded.length === 1 ? "Arquivo enviado" : `${uploaded.length} arquivos enviados` });
    } catch (err: any) {
      console.error("[CustomFieldFileInput] upload error:", err);
      const diag = await logUploadDiagnostics({
        section: "Campos importantes",
        bucket: getStorageBucket("campo_customizado"),
        path: currentPath,
        tenant_id: tenantId,
        field_key: fieldKey,
        field_type: "file",
        deal_id: dealId ?? null,
        file_name: currentFile?.name ?? null,
        file_size: currentFile?.size ?? null,
        file_mime: currentFile?.type ?? null,
        error: err,
      });
      const status = diag?.errorInfo?.status ? ` [HTTP ${diag.errorInfo.status}]` : "";
      toast({
        title: "Erro ao enviar",
        description: `${err?.message || String(err)}${status} — ver console [ProjectUploadDiagnostics]`,
        variant: "destructive",
      });
    } finally {
      e.target.value = "";
      setBusy(false);
    }
  }

  async function handleRemove(idx: number) {
    const target = items[idx];
    if (!target) return;
    setRemovingIdx(idx);
    try {
      try {
        await supabase.storage.from(getStorageBucket("campo_customizado")).remove([target.storage_path]);
      } catch (err) {
        console.warn("[CustomFieldFileInput] remove storage error:", err);
      }
      const next = items.filter((_, i) => i !== idx);
      await persist(next);
    } finally {
      setRemovingIdx(null);
    }
  }

  return (
    <>
      <div className={cn("flex flex-col gap-1.5 min-w-0 w-full", className)}>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleUpload}
          disabled={!canUpload || busy}
        />

        {items.length > 0 && (
          <div className="flex flex-col gap-1">
          {items.map((meta, idx) => {
              const isExternal = /^https?:\/\//i.test(meta.storage_path);
              const previewTarget: FilePreviewTarget = {
                bucket: isExternal ? "external" : getStorageBucket("campo_customizado"),
                storage_path: meta.storage_path,
                filename: meta.filename,
                mime: meta.mime,
                size: meta.size,
                uploaded_at: meta.uploaded_at,
                origin_label: "Campo customizado",
              };
              return (
              <div
                key={meta.storage_path}
                className={cn(
                  "flex items-center gap-1.5 min-w-0 text-xs px-2 py-1 rounded border border-border bg-muted/30 hover:bg-muted/60 transition-colors",
                  compact && "h-7"
                )}
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                <button
                  type="button"
                  onClick={() => setPreview(previewTarget)}
                  className="flex-1 min-w-0 text-left truncate text-foreground hover:underline"
                  title={meta.filename}
                >
                  {meta.filename}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => setPreview(previewTarget)}
                  title="Visualizar"
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleRemove(idx)}
                  disabled={removingIdx === idx || disabled}
                  title="Remover arquivo"
                >
                  {removingIdx === idx ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              </div>
              );
            })}
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn("justify-center gap-1.5 text-xs", compact && "h-7")}
          onClick={() => inputRef.current?.click()}
          disabled={!canUpload || busy}
          title={canUpload ? "Anexar arquivo(s)" : "Salve o registro antes de anexar"}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : items.length === 0 ? (
            <Upload className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {busy
            ? "Enviando..."
            : !canUpload
              ? "Salve para anexar"
              : items.length === 0
                ? "Anexar arquivo(s)"
                : "Anexar mais"}
        </Button>
      </div>

      <FilePreviewModal target={preview} onClose={() => setPreview(null)} />
    </>
  );
}
