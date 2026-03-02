import React from "react";
import { motion } from "framer-motion";
import { Sun, Zap, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentPowerKw: number;
  isGenerating: boolean;
}

/** Enterprise energy flow: Panels → Inverter → Home/Grid */
export function EnergyFlowAnimation({ currentPowerKw, isGenerating }: Props) {
  return (
    <div className="relative flex items-center justify-between gap-4 py-8 px-6 md:px-12">
      {/* Solar Panels */}
      <FlowNode
        icon={Sun}
        label="Painéis"
        value={isGenerating ? `${currentPowerKw.toFixed(1)} kW` : "0 kW"}
        color="warning"
        pulse={isGenerating}
      />

      {/* Flow line 1 */}
      <FlowLine active={isGenerating} />

      {/* Inverter */}
      <FlowNode
        icon={Zap}
        label="Inversor"
        value={isGenerating ? "Ativo" : "Standby"}
        color={isGenerating ? "success" : "muted"}
        pulse={isGenerating}
      />

      {/* Flow line 2 */}
      <FlowLine active={isGenerating} delay={0.5} />

      {/* Home / Grid */}
      <FlowNode
        icon={Home}
        label="Consumo"
        value={isGenerating ? "Alimentando" : "Rede"}
        color={isGenerating ? "primary" : "muted"}
        pulse={false}
      />
    </div>
  );
}

type NodeColor = "warning" | "success" | "primary" | "muted";

const NODE_COLORS: Record<NodeColor, { bg: string; text: string; ring: string }> = {
  warning: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/20" },
  success: { bg: "bg-success/10", text: "text-success", ring: "ring-success/20" },
  primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" },
  muted: { bg: "bg-muted", text: "text-muted-foreground", ring: "ring-border/40" },
};

function FlowNode({
  icon: Icon,
  label,
  value,
  color,
  pulse,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: NodeColor;
  pulse: boolean;
}) {
  const s = NODE_COLORS[color];
  return (
    <div className="flex flex-col items-center gap-3 z-10">
      <motion.div
        className={cn(
          "h-16 w-16 rounded-full flex items-center justify-center ring-2",
          s.bg,
          s.ring
        )}
        animate={pulse ? { scale: [1, 1.06, 1] } : {}}
        transition={pulse ? { duration: 2.5, repeat: Infinity, ease: "easeInOut" } : {}}
      >
        <Icon className={cn("h-7 w-7", s.text)} />
      </motion.div>
      <div className="text-center">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function FlowLine({ active, delay = 0 }: { active: boolean; delay?: number }) {
  return (
    <div className="flex-1 relative h-0.5 rounded-full bg-border/30 overflow-hidden min-w-[60px]">
      {active && (
        <motion.div
          className="absolute inset-y-0 left-0 w-10 rounded-full bg-gradient-to-r from-transparent via-primary/70 to-transparent"
          animate={{ x: ["-100%", "500%"] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          }}
        />
      )}
    </div>
  );
}
