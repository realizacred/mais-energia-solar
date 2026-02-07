import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import serviceProjeto from "@/assets/service-projeto.jpg";
import serviceHomologacao from "@/assets/service-homologacao.jpg";
import serviceInstalacao from "@/assets/service-instalacao.jpg";
import serviceManutencao from "@/assets/service-manutencao.jpg";

const services = [
  {
    title: "Projeto",
    step: "01",
    description: "Elaboramos um projeto único e customizado para atender as suas necessidades, utilizando softwares de cálculo avançados.",
    image: serviceProjeto,
  },
  {
    title: "Homologação",
    step: "02",
    description: "Cuidamos de todo o processo de legalização junto à distribuidora de energia, sem burocracia para você.",
    image: serviceHomologacao,
  },
  {
    title: "Instalação",
    step: "03",
    description: "Instalamos o seu sistema usando os melhores equipamentos do mercado, com garantia e segurança total.",
    image: serviceInstalacao,
  },
  {
    title: "Manutenção",
    step: "04",
    description: "Oferecemos manutenção preventiva para garantir que seu sistema funcione com máxima eficiência sempre.",
    image: serviceManutencao,
  },
];

export function ServicesSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="servicos" className="py-20 sm:py-32 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-transparent to-muted/30" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Nossos Serviços
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
            Do projeto à manutenção
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Cuidamos de tudo para você ter a melhor experiência com energia solar.
          </p>
        </motion.div>

        {/* Service Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="group relative rounded-2xl overflow-hidden bg-card border border-border/50 hover:border-primary/20 hover:shadow-xl transition-all duration-500"
            >
              {/* Image */}
              <div className="relative h-52 sm:h-60 overflow-hidden">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent" />
                {/* Step number */}
                <span className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-primary/90 backdrop-blur-sm flex items-center justify-center text-primary-foreground text-sm font-bold">
                  {service.step}
                </span>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6">
                <h3 className="font-display text-xl font-bold text-foreground mb-2">{service.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {service.description}
                </p>
                <a
                  href="https://wa.me/5532998437675"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-3 transition-all duration-300"
                >
                  Saiba mais
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
