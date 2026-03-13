import { useState } from "react";
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

/**
 * Reusable WhatsApp profile avatar with onError fallback.
 * When the profile picture URL is expired/broken, falls back to initials or icon.
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
  const [imgError, setImgError] = useState(false);

  const showImg = !!profilePictureUrl && profilePictureUrl !== "none" && !imgError;

  const fallback = isGroup ? (
    <Users className={iconSizes[size]} />
  ) : name ? (
    name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
  ) : (
    <User className={iconSizes[size]} />
  );

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
          src={profilePictureUrl}
          alt=""
          className="w-full h-full rounded-full object-cover"
          onError={() => setImgError(true)}
          loading="lazy"
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
