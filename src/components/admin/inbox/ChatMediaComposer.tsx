import { useState, useRef, useCallback } from "react";
import { Mic, Square, Upload, Loader2, Video, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getCurrentTenantId, tenantPath } from "@/lib/storagePaths";

interface ChatMediaComposerProps {
  conversationId: string;
  disabled?: boolean;
  onMediaSent: (mediaUrl: string, type: "audio" | "video" | "document") => void;
}

export function ChatMediaComposer({
  conversationId,
  disabled,
  onMediaSent,
}: ChatMediaComposerProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadToStorage = useCallback(
    async (blob: Blob, ext: string): Promise<string | null> => {
      setIsUploading(true);
      try {
        const tid = await getCurrentTenantId();
        if (!tid) throw new Error("Tenant não encontrado");
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || "unknown";
        const fileName = tenantPath(tid, userId, conversationId, `${Date.now()}.${ext}`);

        const { error } = await supabase.storage
          .from("wa-attachments")
          .upload(fileName, blob, { upsert: true });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("wa-attachments")
          .getPublicUrl(fileName);

        return urlData.publicUrl;
      } catch (err: any) {
        console.error("Upload error:", err);
        toast({
          title: "Erro no upload",
          description: err?.message || "Não foi possível enviar o arquivo.",
          variant: "destructive",
        });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [conversationId]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) return; // ignore tiny blobs

        const url = await uploadToStorage(blob, "webm");
        if (url) onMediaSent(url, "audio");
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch {
      toast({
        title: "Sem acesso ao microfone",
        description: "Permita o acesso ao microfone nas configurações do navegador.",
        variant: "destructive",
      });
    }
  }, [uploadToStorage, onMediaSent]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      // Remove the onstop handler to prevent upload
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current = null;
      };
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O limite é 50MB.",
          variant: "destructive",
        });
        return;
      }

      const ext = file.name.split(".").pop() || "bin";
      const url = await uploadToStorage(file, ext);
      if (!url) return;

      let type: "audio" | "video" | "document" = "document";
      if (file.type.startsWith("video/")) type = "video";
      else if (file.type.startsWith("audio/")) type = "audio";

      onMediaSent(url, type);

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadToStorage, onMediaSent]
  );

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0 text-muted-foreground"
          onClick={cancelRecording}
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive">{formatTime(recordingTime)}</span>
          <span className="text-xs text-muted-foreground">Gravando áudio...</span>
        </div>
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 bg-destructive hover:bg-destructive/90"
          onClick={stopRecording}
        >
          <Square className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Anexar arquivo/vídeo</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={startRecording}
            disabled={disabled || isUploading}
          >
            <Mic className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Gravar áudio</TooltipContent>
      </Tooltip>
    </div>
  );
}
