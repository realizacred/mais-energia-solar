import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatMediaMessageProps {
  messageType: string;
  mediaUrl: string | null;
  content: string | null;
  isOut: boolean;
}

export function ChatMediaMessage({ messageType, mediaUrl, content, isOut }: ChatMediaMessageProps) {
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
        <div className="flex items-center gap-2 p-2 rounded-lg bg-background/30 mb-1">
          <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="text-xs truncate flex-1">
            {content || "Documento"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            asChild
          >
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" download>
              <Download className="h-3 w-3" />
            </a>
          </Button>
        </div>
      );

    default:
      return null;
  }
}
