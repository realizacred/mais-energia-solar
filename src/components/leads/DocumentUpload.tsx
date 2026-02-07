import { useRef, ChangeEvent, useState } from "react";
import { Camera, Upload, X, FileText, Image, WifiOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";

// Document file with base64 data for offline support
export interface DocumentFile {
  name: string;
  size: number;
  type: string;
  // base64 data URL for offline storage, or storage path after upload
  data: string;
  // True if already uploaded to storage
  uploaded: boolean;
}

interface DocumentUploadProps {
  label: string;
  description: string;
  files: DocumentFile[];
  onFilesChange: (files: DocumentFile[]) => void;
  accept?: string;
  required?: boolean;
  maxSizeMB?: number;
  showPreview?: boolean;
}

export function DocumentUpload({
  label,
  description,
  files,
  onFilesChange,
  accept = "image/*,.pdf",
  required = false,
  maxSizeMB = 10,
  showPreview = true,
}: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const isOnline = navigator.onLine;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Arquivo muito grande. Máximo permitido: ${maxSizeMB}MB`;
    }
    if (files.some(f => f.name === file.name)) {
      return "Este arquivo já foi adicionado.";
    }
    return null;
  };

  const handleAddFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    
    const processedFiles: DocumentFile[] = [];
    
    for (const file of newFiles) {
      const error = validateFile(file);
      if (error) {
        toast({
          title: "Erro",
          description: error,
          variant: "destructive",
        });
        continue;
      }

      try {
        // Convert to base64 for offline storage
        const base64Data = await fileToBase64(file);
        
        processedFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64Data,
          uploaded: false,
        });
      } catch (error) {
        console.error("Error converting file to base64:", error);
        toast({
          title: "Erro",
          description: `Não foi possível processar ${file.name}`,
          variant: "destructive",
        });
      }
    }

    if (processedFiles.length > 0) {
      onFilesChange([...files, ...processedFiles]);
      
      toast({
        title: "Arquivo(s) adicionado(s)!",
        description: isOnline 
          ? `${processedFiles.length} arquivo(s) pronto(s) para envio.`
          : `${processedFiles.length} arquivo(s) salvo(s) localmente. Serão enviados quando estiver online.`,
      });
    }
    
    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const openCamera = () => {
    cameraInputRef.current?.click();
  };

  const getFileIcon = (file: DocumentFile) => {
    if (file.type.startsWith("image/")) {
      return <Image className="h-3 w-3" />;
    }
    return <FileText className="h-3 w-3" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>

      {/* Offline indicator */}
      {!isOnline && files.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-warning/20 text-warning-foreground rounded-lg text-xs">
          <WifiOff className="w-3 h-3" />
          <span>Arquivos salvos localmente - serão enviados quando online</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map((file, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1 py-1 px-2 max-w-full group"
            >
              {getFileIcon(file)}
              <span className="truncate max-w-[100px] text-xs">{file.name}</span>
              <span className="text-muted-foreground text-xs">
                ({formatFileSize(file.size)})
              </span>
              {!file.uploaded && !isOnline && (
                <span className="text-xs text-destructive">(pendente)</span>
              )}
              {showPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewIndex(index);
                    setPreviewOpen(true);
                  }}
                  className="ml-1 hover:text-primary transition-colors"
                  aria-label="Visualizar arquivo"
                >
                  <Eye className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemoveFile(index)}
                className="ml-1 hover:text-destructive transition-colors"
                aria-label="Remover arquivo"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Camera button - prioritized on mobile */}
        {isMobile && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCamera}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            Tirar Foto
          </Button>
        )}
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openFileSelector}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {isMobile ? "Galeria" : "Selecionar Arquivo"}
        </Button>
      </div>

      {/* Hidden file input for gallery/files */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleAddFiles}
        className="sr-only"
      />

      {/* Hidden camera input for mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleAddFiles}
        className="sr-only"
      />
      
      {/* Preview dialog */}
      {showPreview && (
        <DocumentPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          files={files}
          initialIndex={previewIndex}
          title={label}
        />
      )}
    </div>
  );
}

// Utility function to upload document files to Supabase storage
export async function uploadDocumentFiles(
  files: DocumentFile[],
  folder: string,
  supabaseClient: any,
  bucket: string = "documentos-cliente"
): Promise<string[]> {
  const uploadedUrls: string[] = [];
  
  for (const file of files) {
    if (file.uploaded) {
      // Already uploaded, just use the existing path
      uploadedUrls.push(file.data);
      continue;
    }

    try {
      // Convert base64 to blob
      const response = await fetch(file.data);
      const blob = await response.blob();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error } = await supabaseClient.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: file.type,
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      uploadedUrls.push(fileName);
    } catch (error) {
      console.error('Failed to upload file:', file.name, error);
      // Continue with other files even if one fails
    }
  }
  
  return uploadedUrls;
}
