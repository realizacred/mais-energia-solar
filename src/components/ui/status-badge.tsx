import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Clock,
  Loader2,
  Ban,
  Zap,
} from "lucide-react";

/**
 * StatusBadge — unified status display component.
 * Maps status strings to semantic variants automatically.
 * Solid fills with WCAG AA contrast. No ad-hoc styling.
 */

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-200 whitespace-nowrap",
  {
    variants: {
      variant: {
        success:
          "bg-success text-success-foreground",
        error:
          "bg-destructive text-destructive-foreground",
        warning:
          "bg-warning text-warning-foreground",
        info:
          "bg-info text-info-foreground",
        neutral:
          "bg-muted text-muted-foreground",
        pending:
          "bg-warning/90 text-warning-foreground",
        active:
          "bg-primary text-primary-foreground",
        inactive:
          "bg-muted text-muted-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-2xs gap-1",
        default: "px-2.5 py-1 text-xs gap-1.5",
        lg: "px-3 py-1.5 text-sm gap-2",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  }
);

const VARIANT_ICONS: Record<string, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  neutral: Clock,
  pending: Loader2,
  active: Zap,
  inactive: Ban,
};

/** Auto-detect variant from common status strings */
const STATUS_MAP: Record<string, string> = {
  // Success
  ativo: "success",
  active: "success",
  aprovado: "success",
  approved: "success",
  concluido: "success",
  completed: "success",
  fechado: "success",
  pago: "success",
  paid: "success",
  confirmado: "success",
  confirmed: "success",
  convertido: "success",
  done: "success",
  resolvido: "success",

  // Error
  inativo: "error",
  inactive: "inactive",
  cancelado: "error",
  cancelled: "error",
  rejeitado: "error",
  rejected: "error",
  perdido: "error",
  lost: "error",
  vencido: "error",
  overdue: "error",
  inadimplente: "error",
  erro: "error",
  error: "error",
  failed: "error",

  // Warning
  pendente: "pending",
  pending: "pending",
  aguardando: "pending",
  waiting: "pending",
  atrasado: "warning",
  delayed: "warning",
  alerta: "warning",
  warning: "warning",
  risco: "warning",
  parcial: "warning",

  // Info
  novo: "info",
  new: "info",
  aberto: "info",
  open: "info",
  em_andamento: "info",
  in_progress: "info",
  processando: "info",
  processing: "info",
  agendado: "info",
  scheduled: "info",

  // Active
  ativo_destaque: "active",
};

function normalizeStatus(status: string): string {
  return status
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "_")
    .trim();
}

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof statusBadgeVariants> {
  /** Status text to display */
  status: string;
  /** Override auto-detected variant */
  variant?: "success" | "error" | "warning" | "info" | "neutral" | "pending" | "active" | "inactive";
  /** Show icon */
  showIcon?: boolean;
  /** Custom icon override */
  icon?: React.ElementType;
}

function StatusBadge({
  status,
  variant: explicitVariant,
  size,
  showIcon = true,
  icon: CustomIcon,
  className,
  ...props
}: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const autoVariant = STATUS_MAP[normalized] || "neutral";
  const resolvedVariant = (explicitVariant || autoVariant) as NonNullable<VariantProps<typeof statusBadgeVariants>["variant"]>;
  
  const IconComponent = CustomIcon || VARIANT_ICONS[resolvedVariant] || Clock;

  return (
    <div
      className={cn(statusBadgeVariants({ variant: resolvedVariant, size }), className)}
      {...props}
    >
      {showIcon && <IconComponent className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{status}</span>
    </div>
  );
}

StatusBadge.displayName = "StatusBadge";

export { StatusBadge, statusBadgeVariants };
