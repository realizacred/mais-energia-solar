/**
 * ImagePicker — Upload + galeria reutilizável para o editor de propostas.
 * Bucket: brand-assets/{tenant_id}/proposal-images/
 *
 * Reaproveita:
 *   - useTenantId (hook existente)
 *   - bucket público brand-assets já provisionado com RLS por tenant
 */
import { useEffect, useRef, useState } from "react";
import { Upload, ImageIcon, Loader2, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  value?: string;
  onSelect: (url: string) => void;
  /** Quando true, exibe como popover compacto (uso dentro do editor de texto). */
  compact?: boolean;
}

interface GalleryItem {
  name: string;
  url: string;
  fullPath: string;
}

const FOLDER = "proposal-images";
const ACCEPTED = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_SIZE_MB = 5;

export function ImagePicker({ value, onSelect, compact = false }: Props) {
  const { data: tenantId } = useTenantId();
  const [tab, setTab] = useState<"upload" | "gallery" | "url">("upload");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const basePath = tenantId ? `${tenantId}/${FOLDER}` : null;

  const loadGallery = async () => {
    if (!basePath) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("brand-assets")
        .list(basePath, { sortBy: { column: "created_at", order: "desc" }, limit: 100 });
      if (error) throw error;
      const mapped: GalleryItem[] = (data ?? [])
        .filter((f) => f.name && !f.name.startsWith("."))
        .map((f) => {
          const fullPath = `${basePath}/${f.name}`;
          const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(fullPath);
          return { name: f.name, url: pub.publicUrl, fullPath };
        });
      setItems(mapped);
    } catch (e: any) {
      toast.error("Não foi possível carregar a galeria", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "gallery") loadGallery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, basePath]);

  const handleUpload = async (file: File) => {
    if (!basePath) {
      toast.error("Tenant não identificado");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${MAX_SIZE_MB}MB`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const fullPath = `${basePath}/${filename}`;
      const { error } = await supabase.storage
        .from("brand-assets")
        .upload(fullPath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(fullPath);
      onSelect(pub.publicUrl);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error("Falha no upload", { description: e?.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: GalleryItem) => {
    if (!confirm(`Remover "${item.name}"?`)) return;
    const { error } = await supabase.storage.from("brand-assets").remove([item.fullPath]);
    if (error) {
      toast.error("Não foi possível remover", { description: error.message });
      return;
    }
    setItems((prev) => prev.filter((i) => i.fullPath !== item.fullPath));
    toast.success("Imagem removida");
  };

  return (
    <div className={cn("space-y-2", compact ? "w-[320px]" : "w-full")}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="upload" className="text-[11px]">Enviar</TabsTrigger>
          <TabsTrigger value="gallery" className="text-[11px]">Galeria</TabsTrigger>
          <TabsTrigger value="url" className="text-[11px]">URL</TabsTrigger>
        </TabsList>

        {/* UPLOAD */}
        <TabsContent value="upload" className="mt-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors",
              "flex flex-col items-center justify-center gap-2 py-8 px-4 text-center",
              uploading && "opacity-60 cursor-wait"
            )}
          >
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
            <div>
              <p className="text-xs font-medium text-foreground">
                {uploading ? "Enviando..." : "Clique para enviar imagem"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                PNG, JPG, WEBP ou SVG · até {MAX_SIZE_MB}MB
              </p>
            </div>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
        </TabsContent>

        {/* GALERIA */}
        <TabsContent value="gallery" className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Nenhuma imagem ainda</p>
              <p className="text-[10px] text-muted-foreground">Envie pela aba "Enviar"</p>
            </div>
          ) : (
            <ScrollArea className={compact ? "h-64" : "h-72"}>
              <div className="grid grid-cols-3 gap-2 p-0.5">
                {items.map((item) => {
                  const selected = value === item.url;
                  return (
                    <div
                      key={item.fullPath}
                      className={cn(
                        "group relative aspect-square rounded-md border overflow-hidden cursor-pointer hover:border-primary transition-colors",
                        selected && "border-primary ring-2 ring-primary/30"
                      )}
                      onClick={() => onSelect(item.url)}
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover bg-muted"
                        loading="lazy"
                      />
                      {selected && (
                        <div className="absolute top-1 left-1 rounded-full bg-primary text-primary-foreground p-0.5">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item);
                        }}
                        className="absolute top-1 right-1 rounded-full bg-destructive/90 text-destructive-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* URL EXTERNA */}
        <TabsContent value="url" className="mt-2 space-y-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://exemplo.com/imagem.jpg"
            className="text-xs"
          />
          <Button
            type="button"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => {
              if (!urlInput.trim()) {
                toast.error("Cole uma URL válida");
                return;
              }
              onSelect(urlInput.trim());
              toast.success("URL aplicada");
            }}
          >
            Usar esta URL
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Recomendamos enviar para a galeria — assim não depende de servidores externos.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
