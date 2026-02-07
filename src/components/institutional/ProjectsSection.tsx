import { MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import obra1 from "@/assets/obra-1.jpg";
import obra2 from "@/assets/obra-2.jpg";
import obra3 from "@/assets/obra-3.jpg";
import obra4 from "@/assets/obra-4.jpg";

const projects = [
  {
    titulo: "Projeto Fotovoltaico de 3.89 kWp",
    cidade: "Cataguases - MG",
    imagem: obra1,
  },
  {
    titulo: "Projeto Fotovoltaico de 3,35 kWp",
    cidade: "Argirita - MG",
    imagem: obra2,
  },
  {
    titulo: "Projeto Fotovoltaico de 3,27 kWp",
    cidade: "Cataguases - MG",
    imagem: obra3,
  },
  {
    titulo: "Projeto Fotovoltaico de 7,22 kWp",
    cidade: "Cataguases - MG",
    imagem: obra4,
  },
];

export function ProjectsSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="obras" className="py-20 sm:py-32 bg-muted/30 relative overflow-hidden">
      <div ref={ref} className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Nosso Portfólio
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
            Obras Realizadas
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Conheça alguns dos projetos que já realizamos em Minas Gerais.
          </p>
        </motion.div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {projects.map((project, i) => (
            <motion.div
              key={project.titulo}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="group rounded-2xl overflow-hidden bg-card border border-border/50 hover:shadow-xl hover:border-primary/20 transition-all duration-500"
            >
              <div className="relative h-60 sm:h-72 overflow-hidden">
                <img
                  src={project.imagem}
                  alt={project.titulo}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-5 transform group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-white font-display font-bold text-base mb-1.5">{project.titulo}</h3>
                  <p className="text-white/70 text-sm flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    {project.cidade}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
