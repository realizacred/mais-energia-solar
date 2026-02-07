import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, X, FileText, Image, Loader2, Camera, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface FileUploadOfflineProps {
  onFilesChange: (files: OfflineFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export interface OfflineFile {
  name: string;
  size: number;
  type: string;
  // For offline: base64 data URL; For online/synced: storage path
  data: string;
  // True if already uploaded to storage
  uploaded: boolean;
}

export default function FileUploadOffline({ 
  onFilesChange, 
  maxFiles = 10, 
  maxSizeMB = 10 
}: FileUploadOfflineProps) {
  const [files, setFiles] = useState<OfflineFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const isOnline = navigator.onLine;

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  const validateFile = (file: File): string | null => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    
    if (!allowedTypes.includes(file.type)) {
      return "Formato inválido. Apenas PDF, JPG e PNG são aceitos.";
    }
    
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Arquivo muito grande. Máximo permitido: ${maxSizeMB}MB`;
    }
    
    if (files.some(f => f.name === file.name)) {
      return "Este arquivo já foi adicionado.";
    }
    
    if (files.length >= maxFiles) {
      return `Limite de ${maxFiles} arquivos atingido.`;
    }
    
    return null;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const filesToProcess = Array.from(fileList);
    const validFiles: File[] = [];

    for (const file of filesToProcess) {
      const error = validateFile(file);
      if (error) {
        toast({
          title: "Erro",
          description: error,
          variant: "destructive",
        });
      } else {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) return;

    setIsProcessing(true);

    try {
      const processedFiles: OfflineFile[] = [];

      for (const file of validFiles) {
        // Convert to base64 for local storage (works offline)
        const base64Data = await fileToBase64(file);
        
        processedFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          data: base64Data,
          uploaded: false,
        });
      }
      
      const newFiles = [...files, ...processedFiles];
      setFiles(newFiles);
      onFilesChange(newFiles);

      toast({
        title: "Arquivo(s) adicionado(s)!",
        description: isOnline 
          ? `${processedFiles.length} arquivo(s) pronto(s) para envio.`
          : `${processedFiles.length} arquivo(s) salvo(s) localmente. Serão enviados quando você estiver online.`,
      });
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "Erro ao processar arquivo",
        description: "Não foi possível processar alguns arquivos.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const getFileIcon = (type: string) => {
    return type.startsWith('image/') ? (
      <Image className="w-5 h-5 text-primary" />
    ) : (
      <FileText className="w-5 h-5 text-secondary" />
    );
  };

  const handleCameraCapture = () => {
    cameraInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="flex items-center gap-2 p-2 bg-warning/20 text-warning-foreground rounded-lg text-sm">
          <WifiOff className="w-4 h-4" />
          <span>Modo offline - arquivos serão enviados quando a conexão voltar</span>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center
          transition-all duration-200
          ${isDragging 
            ? 'border-primary bg-primary/5 scale-[1.01]' 
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }
          ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Processando arquivos...</p>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-3 text-sm">
              {isMobile ? "Tire uma foto ou selecione arquivos" : "Arraste arquivos aqui ou use os botões abaixo"}
            </p>
            
            <div className="flex gap-2 justify-center flex-wrap">
              {isMobile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCameraCapture();
                  }}
                  className="px-4 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Tirar Foto
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Selecionar Arquivos
              </button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-3">
              Formatos aceitos: PDF, JPG, PNG (máx. {maxSizeMB}MB)
            </p>
          </>
        )}
        
        {/* Input para galeria/arquivos */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={handleInputChange}
          className="sr-only"
        />
        
        {/* Input para câmera (mobile) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          className="sr-only"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Arquivos selecionados ({files.length})
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg group hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(file.type)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                      {!file.uploaded && !isOnline && (
                        <span className="ml-2 text-destructive">(pendente)</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  title="Remover arquivo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Utility function to upload offline files to storage during sync
export async function uploadOfflineFiles(files: OfflineFile[]): Promise<string[]> {
  const uploadedUrls: string[] = [];
  
  for (const file of files) {
    if (file.uploaded) {
      // Already uploaded, just use the existing URL
      uploadedUrls.push(file.data);
      continue;
    }

    try {
      // Convert base64 to blob
      const response = await fetch(file.data);
      const blob = await response.blob();
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error } = await supabase.storage
        .from('contas-luz')
        .upload(filePath, blob, {
          contentType: file.type,
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      uploadedUrls.push(filePath);
    } catch (error) {
      console.error('Failed to upload file:', file.name, error);
      // Continue with other files even if one fails
    }
  }
  
  return uploadedUrls;
}
