import { useEffect, useMemo, useState } from "react";
import { User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface WaProfileAvatarProps {
  profilePictureUrl: string | null;
  isGroup: boolean;
  name: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  hasUnread?: boolean;
  statusDotClassName?: string;
  colorByName?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8 text-[10px]",
  md: "w-10 h-10 text-[10px]",
  lg: "w-12 h-12 text-xs",
} as const;

const iconSizes = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

const INVALID_PROFILE_VALUES = new Set(["", "none", "null", "undefined"]);

// Avatar color palette for fallback when no photo — uses semantic-compatible soft tones
const AVATAR_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-800 dark:text-blue-300" },
  { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-800 dark:text-green-300" },
  { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-800 dark:text-purple-300" },
  { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-800 dark:text-amber-300" },
  { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-800 dark:text-rose-300" },
  { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-800 dark:text-cyan-300" },
] as const;

function getColorByName(name: string | null) {
  if (!name) return AVATAR_COLORS[0];
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function normalizeProfilePictureUrl(url: string | null): string | null {
  const normalized = (url ?? "").trim();
  if (INVALID_PROFILE_VALUES.has(normalized.toLowerCase())) return null;
  return normalized;
}

/**
 * Reusable WhatsApp profile avatar with robust onError fallback.
 * Resets error state when URL changes and retries once with cache-busting.
 */
export function WaProfileAvatar({
  profilePictureUrl,
  isGroup,
  name,
  size = "md",
  className,
  hasUnread,
  statusDotClassName,
  colorByName = false,
}: WaProfileAvatarProps) {
  const normalizedUrl = useMemo(() => normalizeProfilePictureUrl(profilePictureUrl), [profilePictureUrl]);
  const [imgSrc, setImgSrc] = useState<string | null>(normalizedUrl);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgSrc(normalizedUrl);
    setImgError(false);
  }, [normalizedUrl]);

  const showImg = !!imgSrc && !imgError;
  const nameColor = colorByName ? getColorByName(name) : null;

  const fallback = isGroup ? (
    <Users className={iconSizes[size]} />
  ) : name ? (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0] ?? "")
      .join("")
      .toUpperCase()
  ) : (
    <User className={iconSizes[size]} />
  );

  const handleImgError = () => {
    if (!imgSrc) {
      setImgError(true);
      return;
    }

    if (!imgSrc.includes("__wa_bust=")) {
      const separator = imgSrc.includes("?") ? "&" : "?";
      setImgSrc(`${imgSrc}${separator}__wa_bust=${Date.now()}`);
      return;
    }

    setImgError(true);
  };

  // Determine fallback colors
  const fallbackColorClasses = colorByName && nameColor && !showImg
    ? `${nameColor.bg} ${nameColor.text}`
    : !showImg
      ? "bg-primary/10 text-primary"
      : "";

  return (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0",
        fallbackColorClasses,
        sizeClasses[size],
        className,
      )}
    >
      {showImg ? (
        <img
          src={imgSrc ?? ""}
          alt={name ? `Foto de perfil de ${name}` : isGroup ? "Foto de perfil do grupo" : "Foto de perfil"}
          className="w-full h-full rounded-full object-cover"
          onError={handleImgError}
          loading="eager"
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
        />
      ) : (
        fallback
      )}
      {statusDotClassName && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card",
            statusDotClassName,
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
