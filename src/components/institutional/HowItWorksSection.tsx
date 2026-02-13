import { ClipboardCheck, Wrench, Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const steps = [
  {
    icon: ClipboardCheck,
    step: "01",
    title: "Análise e Projeto",
    description: "Analisamos sua conta de luz e projetamos o sistema ideal para seu consumo, com simulação de economia real.",
    detail: "Em até 24h você recebe a proposta",
  },
  {
    icon: Wrench,
    step: "02",
    title: "Instalação Profissional",
    description: "Equipe especializada instala o sistema com equipamentos de primeira linha e total segurança.",
    detail: "Instalação em 1 a 5 dias úteis",
  },
  {
    icon: Zap,
    step: "03",
    title: "Homologação e Economia",
    description: "Cuidamos de toda a burocracia com a concessionária. Você só precisa aproveitar a economia.",
    detail: "Garantia de 25 anos nos painéis",
  },
];

export function HowItWorksSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="como-funciona" className="py-20 sm:py-32 bg-muted/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div ref={ref} className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold mb-4 border border-primary/20">
            Como Funciona
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
            Simples, Rápido e Seguro
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Em 3 passos você começa a economizar na conta de luz.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-24 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
              className="relative flex flex-col items-center text-center group"
            >
              {/* Step number circle */}
              <div className="relative z-10 w-20 h-20 rounded-2xl bg-card border-2 border-primary/30 flex items-center justify-center mb-6 shadow-lg shadow-primary/10 group-hover:border-primary group-hover:shadow-xl group-hover:shadow-primary/20 transition-all duration-300 group-hover:-translate-y-1">
                <step.icon className="w-8 h-8 text-primary" />
                <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-extrabold flex items-center justify-center shadow-md">
                  {step.step}
                </span>
              </div>

              <h3 className="font-display text-xl font-bold text-foreground mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-3">{step.description}</p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <ArrowRight className="w-3 h-3" />
                {step.detail}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
