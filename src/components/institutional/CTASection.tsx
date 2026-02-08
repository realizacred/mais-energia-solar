import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ArrowRight, FileText } from "lucide-react";
import financingBg from "@/assets/financing-bg.jpg";

export function CTASection() {
  const { ref, isVisible } = useScrollReveal();
  const { get } = useSiteSettings();

  const whatsapp = get("whatsapp");

  const scrollToContact = () => {
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Background Image */}
      <img
        src={financingBg}
        alt="Painéis solares"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Orange-dominant overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-secondary/80" />
      
      {/* Decorative */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-white/30 via-white/10 to-transparent" />

      {/* Content */}
      <div ref={ref} className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 border border-white/30 text-white text-sm font-bold mb-6 backdrop-blur-sm shadow-lg">
            Financiamento
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6 max-w-3xl mx-auto leading-tight tracking-tight">
            {get("cta_titulo")}
          </h2>
          <p className="text-white/80 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            {get("cta_subtitulo")}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="xl"
              asChild
              className="bg-white text-primary hover:bg-white/90 font-extrabold rounded-full shadow-xl shadow-black/20 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 text-lg px-10 py-7"
            >
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                Solicitar Orçamento
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={scrollToContact}
              className="border-2 border-white/70 bg-white/20 text-white hover:bg-white/30 hover:border-white font-bold px-8 py-6 text-base rounded-full backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 shadow-lg"
            >
              <FileText className="w-4 h-4 mr-2" />
              Preencher Formulário
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
