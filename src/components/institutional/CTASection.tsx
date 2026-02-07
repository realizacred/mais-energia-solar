import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import financingBg from "@/assets/financing-bg.jpg";

export function CTASection() {
  const { ref, isVisible } = useScrollReveal();

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
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/90 via-secondary/85 to-secondary/75" />
      
      {/* Decorative */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

      {/* Content */}
      <div ref={ref} className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 border border-primary/30 text-white text-sm font-semibold mb-6 backdrop-blur-sm">
            Financiamento
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-6 max-w-3xl mx-auto leading-tight tracking-tight">
            Deseja financiar seu sistema de energia solar?
          </h2>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Envie suas informações que nossa equipe irá fazer uma cotação com as instituições
            financeiras parceiras e enviar a melhor proposta para você.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="xl"
              asChild
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full shadow-primary hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5"
            >
              <a href="https://wa.me/5532998437675" target="_blank" rel="noopener noreferrer">
                Solicitar Orçamento
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={scrollToContact}
              className="border-white/30 text-white hover:bg-white/10 hover:border-white/50 font-semibold px-8 py-6 text-base rounded-full backdrop-blur-sm transition-all duration-300"
            >
              Preencher Formulário
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
