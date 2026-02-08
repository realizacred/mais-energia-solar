import { useEffect, useState } from "react";
import { ChevronDown, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import heroImage from "@/assets/hero-solar.jpg";

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {count}
      {suffix}
    </span>
  );
}

export function HeroBanner() {
  const { get } = useSiteSettings();

  const whatsapp = get("whatsapp");
  const stats = [
    { value: get("stat_anos_experiencia") || 15, suffix: "+", label: "Anos de experiência" },
    { value: get("stat_projetos_realizados") || 500, suffix: "+", label: "Projetos realizados" },
    { value: get("stat_economia_percentual") || 90, suffix: "%", label: "Economia na conta" },
  ];

  const scrollToContact = () => {
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollDown = () => {
    document.getElementById("quem-somos")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image with parallax feel */}
      <motion.img
        src={heroImage}
        alt="Painéis solares"
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
      {/* Stronger overlay — laranja dominante */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/95 via-primary/60 to-primary/80" />
      <div className="absolute inset-0 bg-gradient-to-t from-secondary/70 via-transparent to-secondary/30" />

      {/* Animated decorative orbs — bigger & brighter */}
      <motion.div 
        className="absolute top-10 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute -bottom-20 -left-20 w-[600px] h-[600px] bg-primary/15 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute top-1/2 left-1/3 w-80 h-80 bg-secondary-glow/15 rounded-full blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-24">
        <div className="max-w-3xl">
          {/* Badge */}
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/25 border border-primary/40 text-white text-sm font-bold mb-8 backdrop-blur-md shadow-lg shadow-primary/10"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            {get("hero_badge_texto")}
          </motion.span>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] mb-6 tracking-tight"
          >
            {get("hero_titulo")}
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-lg sm:text-xl text-white/80 mb-10 max-w-xl leading-relaxed"
          >
            {get("hero_subtitulo")}
          </motion.p>

          {/* CTA Buttons — BOLD */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-wrap gap-4 mb-16"
          >
            <Button
              size="xl"
              onClick={scrollToContact}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-full shadow-xl shadow-primary/40 hover:shadow-2xl hover:shadow-primary/50 transition-all duration-300 hover:-translate-y-1 text-lg px-10 py-7"
            >
              {get("hero_cta_texto")}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-2 border-white/70 bg-white/20 text-white hover:bg-white/30 hover:border-white font-bold px-8 py-6 text-base rounded-full backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 shadow-lg"
            >
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                {get("hero_cta_whatsapp_texto")}
              </a>
            </Button>
          </motion.div>

          {/* Stats — with orange accents */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="flex gap-8 sm:gap-14"
          >
            {stats.map((stat, i) => (
              <div key={stat.label} className="relative">
                {i > 0 && (
                  <div className="absolute -left-4 sm:-left-7 top-1/2 -translate-y-1/2 w-px h-10 bg-primary/30" />
                )}
                <p className="font-display text-3xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-primary/70">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-sm text-white/50 mt-1 font-medium">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll Down Arrow */}
      <motion.button
        onClick={scrollDown}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/70 transition-colors duration-300"
        aria-label="Rolar para baixo"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="w-8 h-8" />
        </motion.div>
      </motion.button>
    </section>
  );
}
