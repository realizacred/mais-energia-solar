/**
 * Audio Recorder Button — press-to-record, with timer + cancel/send.
 * SRP: only handles recording UI; delegates blob to parent via onSend.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { startRecording, type RecordedAudio } from "@/services/audioRecorder";
import { cn } from "@/lib/utils";

interface AudioRecorderButtonProps {
  onSend: (audio: RecordedAudio) => void;
  disabled?: boolean;
}

export function AudioRecorderButton({ onSend, disabled }: AudioRecorderButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => Promise<RecordedAudio>) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const handleStart = useCallback(async () => {
    setError(null);
    try {
      const { stop } = await startRecording();
      stopRef.current = stop;
      setIsRecording(true);
    } catch (err: any) {
      setError(err.message || "Erro ao iniciar gravação");
    }
  }, []);

  const handleCancel = useCallback(() => {
    // Stop and discard
    if (stopRef.current) {
      stopRef.current().catch(() => {});
      stopRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const handleSend = useCallback(async () => {
    if (!stopRef.current) return;
    try {
      const audio = await stopRef.current();
      stopRef.current = null;
      setIsRecording(false);
      onSend(audio);
    } catch (err: any) {
      setError(err.message || "Erro ao finalizar gravação");
      setIsRecording(false);
    }
  }, [onSend]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        {/* Cancel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleCancel}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cancelar</TooltipContent>
        </Tooltip>

        {/* Timer + pulse */}
        <div className="flex items-center gap-1.5 px-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
          <span className="text-xs font-mono text-destructive font-medium tabular-nums">
            {formatTime(elapsed)}
          </span>
        </div>

        {/* Send */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="h-10 w-10 rounded-xl"
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Enviar áudio</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn("h-10 w-10 shrink-0 rounded-xl", error && "text-destructive")}
          onClick={handleStart}
          disabled={disabled}
        >
          <Mic className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{error || "Gravar áudio"}</TooltipContent>
    </Tooltip>
  );
}
