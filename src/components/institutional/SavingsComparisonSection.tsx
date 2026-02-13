import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { TrendingDown, Leaf, Calendar, Zap } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

function AnimatedValue({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const animated = useAnimatedCounter(value, 2000);
  return <span>{prefix}{Math.round(animated).toLocaleString("pt-BR")}{suffix}</span>;
}

export function SavingsComparisonSection() {
  const { ref, isVisible } = useScrollReveal();
  const { get } = useSiteSettings();

  // Example values — configurable
  const contaAtual = 450;
  const contaComSolar = 65;
  const economiaMensal = contaAtual - contaComSolar;
  const economiaAnual = economiaMensal * 12;
  const economia25Anos = economiaMensal * 12 * 25;

  return (
    <section className="py-20 sm:py-32 bg-secondary relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
      <div className="absolute top-20 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-secondary-foreground text-sm font-bold mb-4 backdrop-blur-sm">
            Economia Real
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-secondary-foreground tracking-tight mb-4">
            Antes x Depois da Energia Solar
          </h2>
          <p className="text-secondary-foreground/60 max-w-2xl mx-auto text-lg">
            Veja a diferença real na conta de luz de quem já investiu em energia solar.*
          </p>
        </motion.div>

        {/* Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="rounded-2xl bg-secondary-foreground/10 backdrop-blur-sm border border-secondary-foreground/10 p-8 text-center"
          >
            <p className="text-secondary-foreground/50 text-sm font-semibold uppercase tracking-wider mb-3">Sem energia solar</p>
            <p className="font-display text-5xl sm:text-6xl font-extrabold text-secondary-foreground/80 mb-2">
              {isVisible ? <AnimatedValue value={contaAtual} prefix="R$ " /> : "R$ 0"}
            </p>
            <p className="text-secondary-foreground/40 text-sm">por mês na conta de luz</p>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-2xl bg-primary/20 backdrop-blur-sm border-2 border-primary/40 p-8 text-center relative"
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-extrabold shadow-lg">
              COM SOLAR
            </div>
            <p className="text-primary/80 text-sm font-semibold uppercase tracking-wider mb-3">Com energia solar</p>
            <p className="font-display text-5xl sm:text-6xl font-extrabold text-secondary-foreground mb-2">
              {isVisible ? <AnimatedValue value={contaComSolar} prefix="R$ " /> : "R$ 0"}
            </p>
            <p className="text-secondary-foreground/60 text-sm">taxa mínima da concessionária</p>
          </motion.div>
        </div>

        {/* Economy stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
        >
          {[
            { icon: TrendingDown, label: "Economia mensal", value: economiaMensal, prefix: "R$ " },
            { icon: Calendar, label: "Economia anual", value: economiaAnual, prefix: "R$ " },
            { icon: Zap, label: "Em 25 anos", value: economia25Anos, prefix: "R$ " },
            { icon: Leaf, label: "CO₂ evitado/ano", value: 2400, suffix: " kg" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-secondary-foreground/5 border border-secondary-foreground/10 p-5 text-center hover:bg-secondary-foreground/10 transition-colors duration-300"
            >
              <stat.icon className="w-6 h-6 text-primary mx-auto mb-2" />
              <p className="font-display text-xl sm:text-2xl font-extrabold text-secondary-foreground">
                {isVisible ? <AnimatedValue value={stat.value} prefix={stat.prefix || ""} suffix={stat.suffix || ""} /> : "0"}
              </p>
              <p className="text-secondary-foreground/40 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="text-center text-secondary-foreground/30 text-xs mt-8 max-w-xl mx-auto"
        >
          * Valores estimados com base em consumo médio de 450 kWh/mês. A economia real pode variar conforme tarifa, localização e consumo. Solicite uma simulação personalizada.
        </motion.p>
      </div>
    </section>
  );
}
