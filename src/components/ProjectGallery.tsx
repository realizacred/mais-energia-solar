import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MapPin, Zap, ChevronLeft, ChevronRight, X } from "lucide-react";

interface Project {
  id: number;
  titulo: string;
  cidade: string;
  estado: string;
  potencia: string;
  economia: string;
  imagem: string;
}

// Placeholder images - replace with actual project photos
const projects: Project[] = [
  {
    id: 1,
    titulo: "Residência Unifamiliar",
    cidade: "São Paulo",
    estado: "SP",
    potencia: "8.4 kWp",
    economia: "R$ 680/mês",
    imagem: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&q=80",
  },
  {
    id: 2,
    titulo: "Comércio Local",
    cidade: "Campinas",
    estado: "SP",
    potencia: "15.2 kWp",
    economia: "R$ 1.200/mês",
    imagem: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=600&q=80",
  },
  {
    id: 3,
    titulo: "Fazenda Solar",
    cidade: "Ribeirão Preto",
    estado: "SP",
    potencia: "45.6 kWp",
    economia: "R$ 3.800/mês",
    imagem: "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?w=600&q=80",
  },
  {
    id: 4,
    titulo: "Condomínio Residencial",
    cidade: "Belo Horizonte",
    estado: "MG",
    potencia: "28.0 kWp",
    economia: "R$ 2.400/mês",
    imagem: "https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=600&q=80",
  },
];

export default function ProjectGallery() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openProject = (project: Project, index: number) => {
    setSelectedProject(project);
    setCurrentIndex(index);
  };

  const navigateProject = (direction: "prev" | "next") => {
    const newIndex = direction === "prev" 
      ? (currentIndex - 1 + projects.length) % projects.length
      : (currentIndex + 1) % projects.length;
    setCurrentIndex(newIndex);
    setSelectedProject(projects[newIndex]);
  };

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Projetos Realizados
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Confira alguns dos nossos projetos instalados em residências, comércios e indústrias.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {projects.map((project, index) => (
            <Card
              key={project.id}
              className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all"
              onClick={() => openProject(project, index)}
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={project.imagem}
                  alt={project.titulo}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <div className="text-white">
                    <p className="font-semibold text-sm">{project.titulo}</p>
                    <p className="text-xs opacity-80">{project.cidade}, {project.estado}</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="w-3 h-3 mr-1" />
                    {project.potencia}
                  </Badge>
                  <span className="text-xs font-medium text-primary">{project.economia}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lightbox Dialog */}
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            {selectedProject && (
              <div className="relative">
                <img
                  src={selectedProject.imagem}
                  alt={selectedProject.titulo}
                  className="w-full h-auto max-h-[70vh] object-cover"
                />
                
                {/* Navigation */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                  onClick={() => navigateProject("prev")}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                  onClick={() => navigateProject("next")}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>

                {/* Info */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{selectedProject.titulo}</h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {selectedProject.cidade}, {selectedProject.estado}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-4 h-4" />
                      {selectedProject.potencia}
                    </span>
                    <Badge className="bg-primary">{selectedProject.economia}</Badge>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
