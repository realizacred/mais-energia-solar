import { useState } from "react";
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DocumentFile } from "./DocumentUpload";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: DocumentFile[];
  initialIndex?: number;
  title?: string;
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  files,
  initialIndex = 0,
  title = "Visualizar Documento",
}: DocumentPreviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);

  const currentFile = files[currentIndex];
  const isImage = currentFile?.type?.startsWith("image/");
  const isPDF = currentFile?.type === "application/pdf";

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1));
    setZoom(1);
    setLoading(true);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0));
    setZoom(1);
    setLoading(true);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleDownload = () => {
    if (!currentFile) return;
    
    const link = document.createElement("a");
    link.href = currentFile.data;
    link.download = currentFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!currentFile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base flex items-center gap-2">
              {isImage ? "🖼️" : "📄"} {title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Zoom controls - only for images */}
              {isImage && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[40px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                title="Download"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* File info */}
          <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
            <span className="truncate max-w-[300px]">{currentFile.name}</span>
            <span>
              {files.length > 1 && `${currentIndex + 1} de ${files.length}`}
            </span>
          </div>
        </DialogHeader>

        {/* Content area */}
        <div className="relative flex-1 min-h-[400px] max-h-[70vh] overflow-auto bg-muted/50 flex items-center justify-center">
          {/* Navigation arrows */}
          {files.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 opacity-80 hover:opacity-100"
                onClick={handlePrevious}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 opacity-80 hover:opacity-100"
                onClick={handleNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Loading indicator */}
          {loading && isImage && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Image preview */}
          {isImage && (
            <img
              src={currentFile.data}
              alt={currentFile.name}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              onLoad={() => setLoading(false)}
            />
          )}

          {/* PDF preview */}
          {isPDF && (
            <iframe
              src={currentFile.data}
              title={currentFile.name}
              className="w-full h-full min-h-[500px]"
            />
          )}

          {/* Other file types */}
          {!isImage && !isPDF && (
            <div className="text-center py-10">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">{currentFile.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Preview não disponível para este tipo de arquivo
              </p>
              <Button onClick={handleDownload} className="mt-4" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Baixar Arquivo
              </Button>
            </div>
          )}
        </div>

        {/* Thumbnails for multiple files */}
        {files.length > 1 && (
          <div className="p-3 border-t bg-muted/30">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {files.map((file, index) => (
                <button
                  key={index}
                  className={`flex-shrink-0 w-16 h-16 rounded-md border-2 overflow-hidden transition-colors ${
                    index === currentIndex
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                  onClick={() => {
                    setCurrentIndex(index);
                    setZoom(1);
                    setLoading(true);
                  }}
                >
                  {file.type.startsWith("image/") ? (
                    <img
                      src={file.data}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
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
