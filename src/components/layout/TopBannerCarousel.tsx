import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSiteBanners } from "@/hooks/useSiteBanners";
import { useSiteSettings } from "@/hooks/useSiteSettings";

/** Hardcoded fallback slides when DB is empty */
const FALLBACK_SLIDES = [
  { titulo: "Simule sua Economia", subtitulo: "Descubra quanto pode economizar", botao_texto: "Simular Agora", botao_link: "#contato" },
  { titulo: "Energia Solar Premium", subtitulo: "Projetos personalizados para você", botao_texto: "Peça um Orçamento", botao_link: "#contato" },
  { titulo: "Financiamento Facilitado", subtitulo: "Parcelas que cabem no bolso", botao_texto: "Saiba Mais", botao_link: "#contato" },
];

export function TopBannerCarousel() {
  const { banners, loading } = useSiteBanners();
  const { get } = useSiteSettings();
  const whatsapp = get("whatsapp");

  const slides = banners.length > 0
    ? banners.map((b) => ({
        titulo: b.titulo || "",
        subtitulo: b.subtitulo || "",
        botao_texto: b.botao_texto || "Saiba Mais",
        botao_link: b.botao_link || "#contato",
      }))
    : FALLBACK_SLIDES;

  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, [slides.length]);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + slides.length) % slides.length);
  }, [slides.length]);

  // Auto-play
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const timer = setInterval(next, 4500);
    return () => clearInterval(timer);
  }, [isPaused, next, slides.length]);

  const handleCtaClick = (link: string) => {
    if (link.startsWith("#")) {
      const el = document.getElementById(link.replace("#", ""));
      el?.scrollIntoView({ behavior: "smooth" });
    } else if (link.startsWith("http")) {
      window.open(link, "_blank", "noopener,noreferrer");
    } else if (link === "whatsapp" && whatsapp) {
      window.open(`https://wa.me/${whatsapp}`, "_blank", "noopener,noreferrer");
    }
  };

  if (loading || slides.length === 0) return null;

  return (
    <div
      className="relative bg-gradient-to-r from-primary via-primary/95 to-primary/85 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Subtle decorative shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex items-center h-9 sm:h-10">
          {/* Prev arrow */}
          {slides.length > 1 && (
            <button
              onClick={prev}
              className="shrink-0 p-1 text-primary-foreground/50 hover:text-primary-foreground transition-colors"
              aria-label="Slide anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Slide content */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex items-center justify-center gap-2 sm:gap-3 text-center"
              >
                <span className="text-primary-foreground font-bold text-xs sm:text-sm truncate">
                  {slides[current].titulo}
                </span>
                {slides[current].subtitulo && (
                  <span className="hidden sm:inline text-primary-foreground/70 text-xs truncate">
                    — {slides[current].subtitulo}
                  </span>
                )}
                {slides[current].botao_texto && (
                  <button
                    onClick={() => handleCtaClick(slides[current].botao_link)}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-primary-foreground text-[11px] sm:text-xs font-bold transition-all duration-200 hover:scale-105 backdrop-blur-sm border border-white/10"
                  >
                    {slides[current].botao_texto}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Next arrow */}
          {slides.length > 1 && (
            <button
              onClick={next}
              className="shrink-0 p-1 text-primary-foreground/50 hover:text-primary-foreground transition-colors"
              aria-label="Próximo slide"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-1">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-[3px] rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-4 bg-primary-foreground"
                    : "w-1.5 bg-primary-foreground/30 hover:bg-primary-foreground/50"
                }`}
                aria-label={`Ir para slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
