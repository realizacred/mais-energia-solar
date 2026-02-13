import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, ImageIcon, Link2 } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { toast } from "@/hooks/use-toast";
import { getCurrentTenantId, tenantPath } from "@/lib/storagePaths";

// ── Image Compression ─────────────────────────────────
const MAX_DIMENSION = 512;
const MAX_SIZE_KB = 150;
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

async function compressImage(file: File): Promise<{ blob: Blob; ext: string }> {
  if (file.type === "image/svg+xml" || file.type === "image/x-icon") {
    return { blob: file, ext: file.name.split(".").pop()?.toLowerCase() || "svg" };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      const tryQuality = (idx: number) => {
        const quality = QUALITY_STEPS[idx] ?? 0.4;
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Falha ao comprimir imagem"));
            if (blob.size <= MAX_SIZE_KB * 1024 || idx >= QUALITY_STEPS.length - 1) {
              resolve({ blob, ext: "webp" });
            } else {
              tryQuality(idx + 1);
            }
          },
          "image/webp",
          quality,
        );
      };
      tryQuality(0);
    };
    img.onerror = () => reject(new Error("Não foi possível ler a imagem"));
    img.src = URL.createObjectURL(file);
  });
}

interface BrandLogoUploadProps {
  label: string;
  description?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  /** subfolder inside brand-assets bucket */
  folder: string;
  accept?: string;
  previewHeight?: string;
}

export function BrandLogoUpload({
  label,
  description,
  value,
  onChange,
  folder,
  accept = "image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon",
  previewHeight = "h-12",
}: BrandLogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2MB for logos)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 2MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) console.warn("Session refresh warning:", refreshError.message);

      const tid = await getCurrentTenantId();
      if (!tid) throw new Error("Tenant não encontrado. Faça login novamente.");

      // Compress image (resize + WebP conversion)
      const { blob: compressedBlob, ext } = await compressImage(file);
      const originalKb = Math.round(file.size / 1024);
      const finalKb = Math.round(compressedBlob.size / 1024);

      const fileName = tenantPath(tid, folder, `${Date.now()}.${ext}`);

      // Delete old file if it's from our bucket
      if (value && value.includes("brand-assets")) {
        const oldPath = value.split("/brand-assets/")[1];
        if (oldPath) {
          await supabase.storage.from("brand-assets").remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from("brand-assets")
        .upload(fileName, compressedBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: ext === "webp" ? "image/webp" : file.type,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("brand-assets")
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);

      const savedPercent = originalKb > 0 ? Math.round((1 - finalKb / originalKb) * 100) : 0;
      toast({
        title: "Upload concluído!",
        description: savedPercent > 10
          ? `Imagem otimizada: ${originalKb}KB → ${finalKb}KB (${savedPercent}% menor)`
          : undefined,
      });
    } catch (err: any) {
      toast({
        title: "Erro no upload",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (value && value.includes("brand-assets")) {
      const oldPath = value.split("/brand-assets/")[1];
      if (oldPath) {
        await supabase.storage.from("brand-assets").remove([oldPath]);
      }
    }
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {/* Preview */}
      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
          <img
            src={value}
            alt={label}
            className={`${previewHeight} max-w-[200px] object-contain rounded bg-background p-1`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate max-w-[250px]">
              {value}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
            onClick={handleRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-dashed text-center">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Nenhuma imagem definida
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="gap-1.5"
        >
          {uploading ? (
            <Spinner size="sm" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? "Enviando..." : "Fazer Upload"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="gap-1.5 text-muted-foreground"
        >
          <Link2 className="h-4 w-4" />
          Colar URL
        </Button>
      </div>

      {/* Fallback URL input */}
      {showUrlInput && (
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="https://..."
          className="text-xs"
        />
      )}
    </div>
  );
}
