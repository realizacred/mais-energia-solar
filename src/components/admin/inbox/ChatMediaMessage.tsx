import { useState } from "react";
import { FileText, Download, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ChatMediaMessageProps {
  messageType: string;
  mediaUrl: string | null;
  content: string | null;
  isOut: boolean;
}

function DocumentPreviewPopup({ url, title, open, onClose }: { url: string; title: string; open: boolean; onClose: () => void }) {
  const isPdf = url.toLowerCase().includes(".pdf");
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(url);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-sm truncate flex-1">{title}</DialogTitle>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
              <a href={url} download>
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border/40 bg-muted/30">
          {isPdf ? (
            <iframe src={url} className="w-full h-[65vh] rounded-lg" title={title} />
          ) : isImage ? (
            <img src={url} alt={title} className="max-w-full mx-auto" />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Pré-visualização não disponível</p>
              <Button asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" /> Abrir no navegador
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChatMediaMessage({ messageType, mediaUrl, content, isOut }: ChatMediaMessageProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!mediaUrl) return null;

  switch (messageType) {
    case "audio":
      return (
        <audio controls className="max-w-full mb-1" preload="metadata">
          <source src={mediaUrl} />
          Seu navegador não suporta áudio.
        </audio>
      );

    case "video":
      return (
        <video
          controls
          className="rounded-lg mb-1 max-w-full max-h-48 object-cover"
          preload="metadata"
          src={mediaUrl}
        />
      );

    case "image":
      return (
        <img
          src={mediaUrl}
          alt="Imagem"
          className="rounded-lg mb-1 max-w-full max-h-48 object-cover cursor-pointer"
          onClick={() => window.open(mediaUrl, "_blank")}
        />
      );

    case "document":
      return (
        <>
          <div
            className="flex items-center gap-2 p-2 rounded-lg bg-background/30 mb-1 cursor-pointer hover:bg-background/50 transition-colors"
            onClick={() => setPreviewOpen(true)}
          >
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="text-xs truncate flex-1">
              {content || "Documento"}
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </div>
          <DocumentPreviewPopup
            url={mediaUrl}
            title={content || "Documento"}
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
          />
        </>
      );

    default:
      return null;
  }
}
