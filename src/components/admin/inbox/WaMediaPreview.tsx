import { useState } from "react";
import { X, Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface MediaPreviewData {
  url: string;
  type: "image" | "video" | "audio" | "document";
  caption?: string;
}

interface WaMediaPreviewProps {
  mediaPreview: MediaPreviewData | null;
  onClose: () => void;
}

export function WaMediaPreview({ mediaPreview, onClose }: WaMediaPreviewProps) {
  const [zoom, setZoom] = useState(1);
  const isImage = mediaPreview?.type === "image";
  const isVideo = mediaPreview?.type === "video";
  const isAudio = mediaPreview?.type === "audio";
  const isDocument = mediaPreview?.type === "document";
  const canZoom = isImage || isDocument;
  const isPdf = mediaPreview?.url?.toLowerCase().includes(".pdf");

  const handleZoomIn = () => setZoom((p) => Math.min(p + 0.25, 3));
  const handleZoomOut = () => setZoom((p) => Math.max(p - 0.25, 0.5));

  return (
    <Dialog open={!!mediaPreview} onOpenChange={(open) => { if (!open) { setZoom(1); onClose(); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
        <DialogTitle className="sr-only">Visualizar mídia</DialogTitle>
        <div className="relative flex flex-col items-center justify-center min-h-[300px]">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
            <span className="text-white/80 text-sm font-medium">
              {isImage ? "Imagem" : isVideo ? "Vídeo" : isAudio ? "Áudio" : "Documento"}
            </span>
            <div className="flex items-center gap-1">
              {canZoom && (
                <>
                  <button onClick={handleZoomOut} disabled={zoom <= 0.5} className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30">
                    <ZoomOut className="h-5 w-5 text-white/80" />
                  </button>
                  <span className="text-white/70 text-xs min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={handleZoomIn} disabled={zoom >= 3} className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30">
                    <ZoomIn className="h-5 w-5 text-white/80" />
                  </button>
                </>
              )}
              <a href={mediaPreview?.url} download target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <Download className="h-5 w-5 text-white/80" />
              </a>
              <a href={mediaPreview?.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <Maximize2 className="h-5 w-5 text-white/80" />
              </a>
              <button onClick={() => { setZoom(1); onClose(); }} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <X className="h-5 w-5 text-white/80" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex items-center justify-center w-full p-4 pt-14 pb-4 overflow-auto">
            {isImage && (
              <img
                src={mediaPreview!.url}
                alt="Preview"
                className="max-w-full max-h-[70vh] object-contain rounded-lg transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
              />
            )}
            {isVideo && (
              <video src={mediaPreview!.url} controls autoPlay className="max-w-full max-h-[70vh] rounded-lg" />
            )}
            {isAudio && (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-3xl">🎵</span>
                </div>
                <audio controls autoPlay className="w-80">
                  <source src={mediaPreview!.url} />
                </audio>
              </div>
            )}
            {isDocument && isPdf && (
              <div className="w-full h-[70vh] overflow-auto">
                <iframe
                  src={mediaPreview!.url}
                  className="border-0 origin-top-left transition-transform duration-200"
                  style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, minHeight: "500px", transform: `scale(${zoom})`, transformOrigin: "top left" }}
                  title="Documento"
                />
              </div>
            )}
            {isDocument && !isPdf && (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <span className="text-3xl">📄</span>
                </div>
                <p className="text-white/80 text-sm">{mediaPreview!.caption || "Documento"}</p>
                <a href={mediaPreview!.url} download target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" className="gap-2">
                    <Download className="h-4 w-4" />
                    Baixar documento
                  </Button>
                </a>
              </div>
            )}
          </div>

          {/* Caption */}
          {mediaPreview?.caption && !isDocument && (
            <div className="w-full px-6 pb-4">
              <p className="text-white/80 text-sm text-center">{mediaPreview.caption}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
