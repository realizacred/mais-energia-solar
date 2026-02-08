import { useState, useEffect } from "react";
import { MapPin, Zap, ChevronLeft, ChevronRight, Video, Clock, TrendingUp, MessageSquareQuote, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import obra1 from "@/assets/obra-exemplo-1.jpg";
import obra2 from "@/assets/obra-exemplo-2.jpg";
import obra3 from "@/assets/obra-exemplo-3.jpg";
import obra4 from "@/assets/obra-exemplo-4.jpg";
import obra5 from "@/assets/obra-exemplo-5.jpg";
import obra6 from "@/assets/obra-exemplo-6.jpg";

interface ObraPublic {
  id: string;
  titulo: string;
  descricao: string | null;
  cidade: string;
  estado: string;
  potencia_kwp: number | null;
  economia_mensal: number | null;
  tipo_projeto: string;
  imagens_urls: string[];
  video_url: string | null;
  numero_modulos: number | null;
  marca_paineis: string | null;
  tempo_instalacao_dias: number | null;
  depoimento_cliente: string | null;
  payback_meses: number | null;
  tags: string[];
}

// Fallback static projects when DB has no data
const FALLBACK_PROJECTS: ObraPublic[] = [
  { id: "1", titulo: "Residência Família Silva", cidade: "Cataguases", estado: "MG", potencia_kwp: 3.89, economia_mensal: 380, tipo_projeto: "residencial", imagens_urls: [obra1], video_url: null, descricao: "Sistema fotovoltaico residencial com painéis de alta eficiência.", numero_modulos: 7, marca_paineis: "Canadian Solar", tempo_instalacao_dias: 1, depoimento_cliente: null, payback_meses: 42, tags: ["residencial", "telhado-ceramico"] },
  { id: "2", titulo: "Residência em Argirita", cidade: "Argirita", estado: "MG", potencia_kwp: 3.35, economia_mensal: 320, tipo_projeto: "residencial", imagens_urls: [obra2], video_url: null, descricao: "Instalação completa em telhado cerâmico com orientação ideal.", numero_modulos: 6, marca_paineis: null, tempo_instalacao_dias: 1, depoimento_cliente: null, payback_meses: null, tags: [] },
  { id: "3", titulo: "Projeto Residencial Cataguases", cidade: "Cataguases", estado: "MG", potencia_kwp: 3.27, economia_mensal: 310, tipo_projeto: "residencial", imagens_urls: [obra3], video_url: null, descricao: "Sistema compacto de alta performance para residência urbana.", numero_modulos: 6, marca_paineis: null, tempo_instalacao_dias: null, depoimento_cliente: null, payback_meses: null, tags: [] },
  { id: "4", titulo: "Sistema 7.22 kWp - Cataguases", cidade: "Cataguases", estado: "MG", potencia_kwp: 7.22, economia_mensal: 690, tipo_projeto: "residencial", imagens_urls: [obra4], video_url: null, descricao: "Projeto de maior porte para residência com alto consumo.", numero_modulos: 13, marca_paineis: "Trina Solar", tempo_instalacao_dias: 2, depoimento_cliente: "Excelente trabalho! A conta de luz caiu mais de 90%.", payback_meses: 36, tags: ["residencial", "monocristalino"] },
  { id: "5", titulo: "Comércio Centro - Leopoldina", cidade: "Leopoldina", estado: "MG", potencia_kwp: 12.50, economia_mensal: 1200, tipo_projeto: "comercial", imagens_urls: [obra5], video_url: null, descricao: "Sistema comercial reduzindo custos operacionais.", numero_modulos: 22, marca_paineis: "JA Solar", tempo_instalacao_dias: 3, depoimento_cliente: null, payback_meses: 30, tags: ["comercial", "telhado-metalico"] },
  { id: "6", titulo: "Fazenda Solar - Miraí", cidade: "Miraí", estado: "MG", potencia_kwp: 18.70, economia_mensal: 1800, tipo_projeto: "rural", imagens_urls: [obra6], video_url: null, descricao: "Projeto rural de grande porte para propriedade agrícola.", numero_modulos: 34, marca_paineis: "LONGi", tempo_instalacao_dias: 5, depoimento_cliente: null, payback_meses: 28, tags: ["rural", "solo", "on-grid"] },
];

export function ProjectsSection() {
  const { ref, isVisible } = useScrollReveal();
  const [projects, setProjects] = useState<ObraPublic[]>(FALLBACK_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<ObraPublic | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const loadObras = async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, titulo, descricao, cidade, estado, potencia_kwp, economia_mensal, tipo_projeto, imagens_urls, video_url, numero_modulos, marca_paineis, tempo_instalacao_dias, depoimento_cliente, payback_meses, tags")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setProjects(data as unknown as ObraPublic[]);
      }
    };
    loadObras();
  }, []);

  const openProject = (project: ObraPublic, index: number) => {
    setSelectedProject(project);
    setCurrentIndex(index);
    setCurrentImageIndex(0);
  };

  const navigateProject = (direction: "prev" | "next") => {
    const newIndex = direction === "prev"
      ? (currentIndex - 1 + projects.length) % projects.length
      : (currentIndex + 1) % projects.length;
    setCurrentIndex(newIndex);
    setSelectedProject(projects[newIndex]);
    setCurrentImageIndex(0);
  };

  const navigateImage = (direction: "prev" | "next") => {
    if (!selectedProject) return;
    const total = selectedProject.imagens_urls.length;
    if (total <= 1) return;
    setCurrentImageIndex(
      direction === "prev"
        ? (currentImageIndex - 1 + total) % total
        : (currentImageIndex + 1) % total
    );
  };

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
              key={project.id}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
              className="group rounded-2xl overflow-hidden bg-card border border-border/50 hover:shadow-xl hover:border-primary/20 transition-all duration-500 cursor-pointer"
              onClick={() => openProject(project, i)}
            >
              <div className="relative h-60 sm:h-72 overflow-hidden">
                <img
                  src={project.imagens_urls?.[0] || obra1}
                  alt={project.titulo}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
                
                {/* Badges */}
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {project.video_url && (
                    <Badge className="bg-foreground/60 backdrop-blur-sm text-background text-[10px] gap-1">
                      <Video className="w-3 h-3" /> Vídeo
                    </Badge>
                  )}
                  {(project.imagens_urls?.length || 0) > 1 && (
                    <Badge className="bg-foreground/60 backdrop-blur-sm text-background text-[10px]">
                      {project.imagens_urls.length} fotos
                    </Badge>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5 transform group-hover:translate-y-0 transition-transform duration-300">
                  <h3 className="text-white font-display font-bold text-base mb-1.5">{project.titulo}</h3>
                  <div className="flex items-center gap-3">
                    <p className="text-white/70 text-sm flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      {project.cidade} - {project.estado}
                    </p>
                    {project.potencia_kwp && (
                      <p className="text-white/70 text-sm flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-primary" />
                        {project.potencia_kwp} kWp
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background">
          {selectedProject && (
            <div className="relative">
              <img
                src={selectedProject.imagens_urls?.[currentImageIndex] || obra1}
                alt={selectedProject.titulo}
                className="w-full h-auto max-h-[70vh] object-cover"
              />

              {/* Image Navigation (if multiple) */}
              {selectedProject.imagens_urls?.length > 1 && (
                <>
                  <Button
                    variant="ghost" size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background shadow-md"
                    onClick={(e) => { e.stopPropagation(); navigateImage("prev"); }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background shadow-md"
                    onClick={(e) => { e.stopPropagation(); navigateImage("next"); }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                  {/* Dots indicator */}
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {selectedProject.imagens_urls.map((_, idx) => (
                      <button
                        key={idx}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentImageIndex ? "bg-primary" : "bg-white/50"
                        }`}
                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(idx); }}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Project Navigation */}
              {projects.length > 1 && (
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button variant="ghost" size="sm" className="bg-background/70 backdrop-blur-sm h-8 px-2" onClick={() => navigateProject("prev")}>
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </Button>
                  <Button variant="ghost" size="sm" className="bg-background/70 backdrop-blur-sm h-8 px-2" onClick={() => navigateProject("next")}>
                    Próximo <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* Info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/90 to-transparent p-6 text-white">
                <h3 className="text-xl font-bold mb-1.5">{selectedProject.titulo}</h3>
                {selectedProject.descricao && (
                  <p className="text-sm text-white/80 mb-2 line-clamp-2">{selectedProject.descricao}</p>
                )}
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-primary" />
                    {selectedProject.cidade} - {selectedProject.estado}
                  </span>
                  {selectedProject.potencia_kwp && (
                    <span className="flex items-center gap-1">
                      <Zap className="w-4 h-4 text-primary" />
                      {selectedProject.potencia_kwp} kWp
                    </span>
                  )}
                  {selectedProject.economia_mensal && (
                    <Badge className="bg-primary text-primary-foreground">
                      Economia: R$ {selectedProject.economia_mensal}/mês
                    </Badge>
                  )}
                  {selectedProject.marca_paineis && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      {selectedProject.marca_paineis}
                    </span>
                  )}
                  {selectedProject.tempo_instalacao_dias && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {selectedProject.tempo_instalacao_dias} dia{selectedProject.tempo_instalacao_dias > 1 ? "s" : ""}
                    </span>
                  )}
                  {selectedProject.payback_meses && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      Payback: {selectedProject.payback_meses} meses
                    </span>
                  )}
                </div>

                {/* Tags */}
                {selectedProject.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedProject.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-white/20 text-white/90 text-[10px] border-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Depoimento */}
                {selectedProject.depoimento_cliente && (
                  <div className="flex items-start gap-2 mt-3 bg-white/10 rounded-lg p-3">
                    <MessageSquareQuote className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-white/90 italic line-clamp-3">
                      {selectedProject.depoimento_cliente}
                    </p>
                  </div>
                )}

                {/* Video link */}
                {selectedProject.video_url && (
                  <a
                    href={selectedProject.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline"
                  >
                    <Video className="w-4 h-4" /> Ver vídeo da obra
                  </a>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
