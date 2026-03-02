import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui-kit/Spinner";

interface StorageFileGalleryProps {
  bucket: string;
  filePaths: string[];
}

interface ResolvedFile {
  path: string;
  name: string;
  url: string;
  isImage: boolean;
}

function useSignedUrls(bucket: string, filePaths: string[]) {
  const [files, setFiles] = useState<ResolvedFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filePaths.length) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      const results: ResolvedFile[] = [];
      // Batch sign – Supabase supports createSignedUrls (plural)
      const { data } = await supabase.storage.from(bucket).createSignedUrls(filePaths, 3600);
      if (cancelled) return;

      for (let i = 0; i < filePaths.length; i++) {
        const path = filePaths[i];
        const name = path.split("/").pop() || `Arquivo ${i + 1}`;
        const isImage = /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(name);
        const url = data?.[i]?.signedUrl || "";
        results.push({ path, name, url, isImage });
      }
      setFiles(results);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [bucket, filePaths]);

  return { files, loading };
}

export function StorageFileGallery({ bucket, filePaths }: StorageFileGalleryProps) {
  const { files, loading } = useSignedUrls(bucket, filePaths);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (loading) return <div className="flex justify-center py-4"><Spinner /></div>;
  if (!files.length) return null;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {files.map((file, index) => (
          <button
            key={file.path}
            className="relative aspect-square rounded-lg border border-border overflow-hidden bg-muted/50 hover:ring-2 hover:ring-primary/40 transition-all group"
            onClick={() => setPreviewIndex(index)}
            title={file.name}
          >
            {file.isImage && file.url ? (
              <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                <FileText className="h-6 w-6 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">{file.name}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {previewIndex !== null && (
        <FilePreviewOverlay
          files={files}
          currentIndex={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </>
  );
}

/* ---------- Overlay ---------- */

interface FilePreviewOverlayProps {
  files: ResolvedFile[];
  currentIndex: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}

function FilePreviewOverlay({ files, currentIndex, onIndexChange, onClose }: FilePreviewOverlayProps) {
  const [zoom, setZoom] = useState(1);
  const [imgLoading, setImgLoading] = useState(true);
  const file = files[currentIndex];

  const navigate = useCallback((dir: 1 | -1) => {
    const next = (currentIndex + dir + files.length) % files.length;
    onIndexChange(next);
    setZoom(1);
    setImgLoading(true);
  }, [currentIndex, files.length, onIndexChange]);

  const handleDownload = () => {
    if (!file?.url) return;
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate(-1);
      else if (e.key === "ArrowRight") navigate(1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-background">
          <span className="text-sm font-medium truncate max-w-[50%]">{file.name}</span>
          <div className="flex items-center gap-1">
            {file.isImage && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} disabled={zoom <= 0.5}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(z + 0.25, 3))} disabled={zoom >= 3}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 min-h-[400px] max-h-[70vh] overflow-auto bg-muted/50 flex items-center justify-center">
          {files.length > 1 && (
            <>
              <Button variant="secondary" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 z-10 opacity-80 hover:opacity-100" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="secondary" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 z-10 opacity-80 hover:opacity-100" onClick={() => navigate(1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {imgLoading && file.isImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50"><Spinner size="lg" /></div>
          )}

          {file.isImage ? (
            <img
              src={file.url}
              alt={file.name}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              onLoad={() => setImgLoading(false)}
            />
          ) : (
            <div className="text-center py-10">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground mt-1">Preview não disponível</p>
              <Button onClick={handleDownload} className="mt-4" variant="outline">
                <Download className="h-4 w-4 mr-2" /> Baixar Arquivo
              </Button>
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {files.length > 1 && (
          <div className="p-3 border-t bg-muted/30">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-muted-foreground self-center mr-1">{currentIndex + 1}/{files.length}</span>
              {files.map((f, i) => (
                <button
                  key={f.path}
                  className={`flex-shrink-0 w-14 h-14 rounded-md border-2 overflow-hidden transition-colors ${i === currentIndex ? "border-primary" : "border-transparent hover:border-muted-foreground/30"}`}
                  onClick={() => { onIndexChange(i); setZoom(1); setImgLoading(true); }}
                >
                  {f.isImage && f.url ? (
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
