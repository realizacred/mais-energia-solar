/**
 * Custom WhatsApp-style audio player.
 * Handles ogg/opus, mp4, webm and mpeg formats with automatic fallback.
 * Uses crossOrigin for Supabase Storage URLs.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, RotateCcw, RefreshCw } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);
  const retryCount = useRef(0);

  useEffect(() => {
    if (!src) {
      setError(true);
      setLoading(false);
      return;
    }

    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setError(false);
      setLoading(false);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setEnded(true);
    };
    const onError = () => {
      console.warn("[WaAudioPlayer] Error loading audio:", src, "readyState:", audio.readyState, "networkState:", audio.networkState);
      // If first attempt fails with the original URL, try appending a cache-buster
      if (retryCount.current === 0 && src.includes("supabase")) {
        retryCount.current = 1;
        const separator = src.includes("?") ? "&" : "?";
        audio.src = `${src}${separator}_t=${Date.now()}`;
        audio.load();
        return;
      }
      setError(true);
      setLoading(false);
    };
    const onCanPlay = () => {
      setError(false);
      setLoading(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);

    // Set src after listeners are attached
    audio.src = src;

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

  const handleRetry = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    retryCount.current = 0;
    setError(false);
    setLoading(true);
    // Force reload with cache-buster
    const separator = src.includes("?") ? "&" : "?";
    audio.src = `${src}${separator}_t=${Date.now()}`;
    audio.load();
  }, [src]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (ended) {
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
        <span>Erro ao carregar áudio</span>
        <button
          onClick={handleRetry}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          aria-label="Tentar novamente"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 min-w-[200px] max-w-[280px]", className)}>
      {/* Play/Pause/Replay button */}
      <button
        onClick={togglePlay}
        disabled={loading}
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors",
          loading
            ? "bg-muted text-muted-foreground"
            : "bg-primary/15 text-primary hover:bg-primary/25"
        )}
        aria-label={ended ? "Reouvir" : isPlaying ? "Pausar" : "Tocar"}
      >
        {loading ? (
          <div className="w-3.5 h-3.5 border-2 border-muted-foreground/40 border-t-primary rounded-full animate-spin" />
        ) : ended ? (
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
