import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSiteServicos } from "@/hooks/useSiteServicos";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import serviceProjeto from "@/assets/service-projeto.jpg";
import serviceHomologacao from "@/assets/service-homologacao.jpg";
import serviceInstalacao from "@/assets/service-instalacao.jpg";
import serviceManutencao from "@/assets/service-manutencao.jpg";

/** Fallback images keyed by title for backward compatibility */
const DEFAULT_IMAGES: Record<string, string> = {
  Projeto: serviceProjeto,
  Homologação: serviceHomologacao,
  Instalação: serviceInstalacao,
  Manutenção: serviceManutencao,
};

/** Hardcoded fallback when DB is empty or loading */
const FALLBACK_SERVICES = [
  { titulo: "Projeto", descricao: "Elaboramos um projeto único e customizado para atender as suas necessidades, utilizando softwares de cálculo avançados." },
  { titulo: "Homologação", descricao: "Cuidamos de todo o processo de legalização junto à distribuidora de energia, sem burocracia para você." },
  { titulo: "Instalação", descricao: "Instalamos o seu sistema usando os melhores equipamentos do mercado, com garantia e segurança total." },
  { titulo: "Manutenção", descricao: "Oferecemos manutenção preventiva para garantir que seu sistema funcione com máxima eficiência sempre." },
];

export function ServicesSection() {
  const { ref, isVisible } = useScrollReveal();
  const { get } = useSiteSettings();
  const whatsapp = get("whatsapp") || "5532998437675";
  const { servicos, loading } = useSiteServicos();

  // Only show active services, fallback to hardcoded if empty
  const activeServicos = servicos.filter((s) => s.ativo);
  const displayServices =
    !loading && activeServicos.length > 0
      ? activeServicos.map((s) => ({
          title: s.titulo,
          description: s.descricao,
          image: s.imagem_url || DEFAULT_IMAGES[s.titulo] || serviceProjeto,
        }))
      : FALLBACK_SERVICES.map((s) => ({
          title: s.titulo,
          description: s.descricao,
          image: DEFAULT_IMAGES[s.titulo] || serviceProjeto,
        }));

  return (
    <section id="servicos" className="py-20 sm:py-32 bg-secondary relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
      <div className="absolute top-20 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        {/* Section Header — white text on dark */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-white text-sm font-bold mb-4 backdrop-blur-sm">
            Nossos Serviços
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Do projeto à manutenção
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto text-lg">
            Cuidamos de tudo para você ter a melhor experiência com energia solar.
          </p>
        </motion.div>

        {/* Service Cards — glass style on dark bg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {displayServices.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="group relative rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/10 hover:border-primary/40 hover:bg-white/15 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500"
            >
              {/* Image */}
              <div className="relative h-52 sm:h-60 overflow-hidden">
                <img
                  src={service.image}
                  alt={service.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 via-secondary/30 to-transparent" />
                {/* Step number — orange accent */}
                <span className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center text-primary-foreground text-sm font-extrabold">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6">
                <h3 className="font-display text-xl font-bold text-white mb-2">{service.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed mb-4">
                  {service.description}
                </p>
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent((get as any)("whatsapp_mensagem_padrao") || "Olá! Gostaria de mais informações sobre energia solar.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:gap-3 transition-all duration-300"
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
