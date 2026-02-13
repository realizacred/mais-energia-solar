import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Shield, Award, BadgeCheck, Building2 } from "lucide-react";

const credentials = [
  { icon: BadgeCheck, label: "Empresa registrada", description: "CNPJ ativo e regularizado" },
  { icon: Shield, label: "Equipe certificada", description: "Profissionais qualificados" },
  { icon: Award, label: "Desde 2009", description: "+15 anos de mercado" },
  { icon: Building2, label: "Homologação completa", description: "Regularização junto à concessionária" },
];

const partners = [
  "Canadian Solar", "Trina Solar", "JA Solar", "LONGi", "Growatt", "Solis",
];

export function PartnersSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-16 sm:py-24 bg-muted/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div ref={ref} className="container mx-auto px-4">
        {/* Credentials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-bold mb-4 border border-secondary/20">
            Credibilidade
          </span>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Por que confiar na Mais Energia Solar?
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-16">
          {credentials.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 30 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
              className="flex flex-col items-center text-center p-5 rounded-2xl bg-card border border-border/50 hover:border-secondary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-3">
                <c.icon className="w-6 h-6 text-secondary" />
              </div>
              <span className="font-bold text-sm text-foreground">{c.label}</span>
              <span className="text-xs text-muted-foreground mt-1">{c.description}</span>
            </motion.div>
          ))}
        </div>

        {/* Partners marquee */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-6">
            Marcas parceiras
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 max-w-3xl mx-auto">
            {partners.map((partner) => (
              <span
                key={partner}
                className="text-sm font-bold text-muted-foreground/60 hover:text-foreground transition-colors duration-300 cursor-default"
              >
                {partner}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
