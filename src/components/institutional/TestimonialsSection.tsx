import { Star, Quote } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const testimonials = [
  {
    id: 1,
    name: "Ricardo Nunes",
    text: "Atendimento maravilhoso, rápido e um pós venda excelente, um investimento que vale a pena fazer. Feliz demais em ver a economia que tenho a cada conta que chega.",
    rating: 5,
  },
  {
    id: 2,
    name: "Maria Lucia",
    text: "Não poderíamos ter feito um investimento melhor! Estamos muito satisfeitos com o serviço e com o sistema!!! Parabéns para toda a equipe! Nota mil!",
    rating: 5,
  },
  {
    id: 3,
    name: "Carlos Eduardo",
    text: "Empresa séria e comprometida com o cliente. O sistema funciona perfeitamente e a economia na conta de luz é real. Super recomendo!",
    rating: 5,
  },
];

export function TestimonialsSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="depoimentos" className="py-20 sm:py-32 bg-card relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Depoimentos
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
            O que dizem nossos Clientes
          </h2>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
              className="relative p-7 sm:p-8 rounded-2xl bg-background border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 group"
            >
              {/* Quote icon */}
              <div className="absolute top-6 right-6 w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
                <Quote className="w-5 h-5 text-primary/40" />
              </div>

              {/* Stars */}
              <div className="flex gap-0.5 mb-5">
                {Array.from({ length: testimonial.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>

              {/* Text */}
              <p className="text-muted-foreground leading-relaxed mb-6 text-sm sm:text-base">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-primary-foreground font-bold text-sm">
                  {testimonial.name.charAt(0)}
                </div>
                <span className="font-display font-bold text-foreground text-sm">{testimonial.name}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
