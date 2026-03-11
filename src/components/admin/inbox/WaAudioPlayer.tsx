/**
 * Custom WhatsApp-style audio player.
 * Fixes replay issues with native <audio> by managing state explicitly.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaAudioPlayerProps {
  src: string;
  className?: string;
}

export function WaAudioPlayer({ src, className }: WaAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  // Create audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = src;
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setError(false);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setEnded(true);
    };
    const onError = () => setError(true);
    const onCanPlay = () => setError(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplay", onCanPlay);
      audio.pause();
      audio.src = "";
    };
  }, [src]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (ended) {
      // Re-listen: reset to start and play
      audio.currentTime = 0;
      setEnded(false);
      setCurrentTime(0);
    }

    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("[WaAudioPlayer] play failed:", err);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [ended]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !duration) return;

    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
    if (ended) setEnded(false);
  }, [duration, ended]);

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-destructive px-2 py-1", className)}>
        Erro ao carregar áudio
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 min-w-[200px] max-w-[280px]", className)}>
      {/* Play/Pause/Replay button */}
      <button
        onClick={togglePlay}
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
        aria-label={ended ? "Reouvir" : isPlaying ? "Pausar" : "Tocar"}
      >
        {ended ? (
          <RotateCcw className="w-3.5 h-3.5" />
        ) : isPlaying ? (
          <Pause className="w-3.5 h-3.5" />
        ) : (
          <Play className="w-3.5 h-3.5 ml-0.5" />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 flex flex-col gap-0.5">
        <div
          ref={progressRef}
          onClick={handleSeek}
          className="relative h-1.5 bg-muted rounded-full cursor-pointer group"
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${progress}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
