import React from "react";
import { motion } from "framer-motion";
import { Sun, Zap, Home, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentPowerKw: number;
  isGenerating: boolean;
}

/** Animated energy flow: Panels → Inverter → Home/Grid */
export function EnergyFlowAnimation({ currentPowerKw, isGenerating }: Props) {
  return (
    <div className="relative flex items-center justify-between gap-2 py-6 px-4">
      {/* Solar Panels */}
      <FlowNode
        icon={Sun}
        label="Painéis"
        value={isGenerating ? `${currentPowerKw.toFixed(1)} kW` : "0 kW"}
        color="warning"
        pulse={isGenerating}
      />

      {/* Flow line 1: Panels → Inverter */}
      <FlowLine active={isGenerating} />

      {/* Inverter */}
      <FlowNode
        icon={Zap}
        label="Inversor"
        value={isGenerating ? "Ativo" : "Standby"}
        color={isGenerating ? "success" : "muted"}
        pulse={isGenerating}
      />

      {/* Flow line 2: Inverter → Grid/Home */}
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
  warning: { bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/30" },
  success: { bg: "bg-success/10", text: "text-success", ring: "ring-success/30" },
  primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/30" },
  muted: { bg: "bg-muted", text: "text-muted-foreground", ring: "ring-border" },
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
    <div className="flex flex-col items-center gap-2 z-10">
      <motion.div
        className={cn(
          "h-14 w-14 rounded-2xl flex items-center justify-center ring-2",
          s.bg,
          s.ring
        )}
        animate={pulse ? { scale: [1, 1.08, 1] } : {}}
        transition={pulse ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
      >
        <Icon className={cn("h-6 w-6", s.text)} />
      </motion.div>
      <div className="text-center">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="text-2xs text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function FlowLine({ active, delay = 0 }: { active: boolean; delay?: number }) {
  return (
    <div className="flex-1 relative h-1 rounded-full bg-border/40 overflow-hidden min-w-[40px]">
      {active && (
        <motion.div
          className="absolute inset-y-0 left-0 w-8 rounded-full bg-gradient-to-r from-primary/0 via-primary to-primary/0"
          animate={{ x: ["-100%", "400%"] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay,
          }}
        />
      )}
    </div>
  );
}
