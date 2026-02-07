import { Shield, Award, HeadphonesIcon, Leaf, Phone, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const values = [
  { icon: Shield, label: "Segurança", description: "Projetos dentro das normas técnicas" },
  { icon: Award, label: "Qualidade", description: "Equipamentos de primeira linha" },
  { icon: HeadphonesIcon, label: "Atendimento", description: "Suporte completo pós-venda" },
  { icon: Leaf, label: "Sustentabilidade", description: "Energia limpa e renovável" },
];

const purposes = [
  "Reduzir custos com energia",
  "Aumentar produtividade no campo",
  "Contribuir para um futuro sustentável",
];

export function AboutSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="quem-somos" className="py-20 sm:py-32 bg-card relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        {/* Section Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Quem Somos
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
            Mais Energia Solar
          </h2>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          {/* About text with modern typography */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-5 text-muted-foreground text-base sm:text-lg leading-relaxed mb-16 max-w-3xl mx-auto text-center"
          >
            <p>
              A <strong className="text-foreground font-semibold">Mais Energia Solar</strong> foi fundada em 2009,
              atuando inicialmente no ramo de reparos em eletrônicos. A partir de 2019, acompanhando
              as tendências do mercado, passamos a nos especializar em{" "}
              <strong className="text-foreground font-semibold">Energia Solar Fotovoltaica, Projetos Elétricos e Soluções Sustentáveis</strong>.
            </p>
            <p>
              Hoje, somos referência no desenvolvimento e instalação de sistemas de energia solar
              e também em bombas solares para irrigação, oferecendo soluções inovadoras para
              propriedades residenciais, comerciais, industriais e rurais.
            </p>
          </motion.div>

          {/* Values - Modern cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-16">
            {values.map((v, i) => (
              <motion.div
                key={v.label}
                initial={{ opacity: 0, y: 30 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="group relative flex flex-col items-center gap-3 p-6 sm:p-8 rounded-2xl bg-background border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <v.icon className="w-7 h-7 text-primary" />
                </div>
                <span className="font-display font-bold text-foreground text-base">{v.label}</span>
                <span className="text-xs text-muted-foreground text-center leading-relaxed">{v.description}</span>
              </motion.div>
            ))}
          </div>

          {/* Purpose - Redesigned */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="relative rounded-3xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary to-secondary/90" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

            <div className="relative z-10 p-8 sm:p-12 md:flex md:items-center md:gap-12">
              <div className="flex-1 mb-8 md:mb-0">
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-4">Nosso Propósito</h3>
                <p className="text-white/70 text-base leading-relaxed">
                  Mais do que fornecer energia limpa, nosso propósito é gerar economia,
                  autonomia e impacto positivo no dia a dia de nossos clientes.
                </p>
              </div>
              <div className="flex-1">
                <ul className="space-y-4 mb-8">
                  {purposes.map((p) => (
                    <li key={p} className="flex items-center gap-3 text-white">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                      <span className="font-medium">{p}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  asChild
                  size="lg"
                  className="bg-primary hover:bg-primary/90 rounded-full px-8 font-bold shadow-primary"
                >
                  <a href="https://wa.me/5532998437675" target="_blank" rel="noopener noreferrer">
                    <Phone className="w-4 h-4 mr-2" />
                    Fale Conosco
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
