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
}: WaProfileAvatarProps) {
  const normalizedUrl = useMemo(() => normalizeProfilePictureUrl(profilePictureUrl), [profilePictureUrl]);
  const [imgSrc, setImgSrc] = useState<string | null>(normalizedUrl);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgSrc(normalizedUrl);
    setImgError(false);
  }, [normalizedUrl]);

  const showImg = !!imgSrc && !imgError;

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

  return (
    <div
      className={cn(
        "relative rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0",
        !showImg && "bg-primary/10 text-primary",
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
          loading="lazy"
          referrerPolicy="no-referrer"
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
