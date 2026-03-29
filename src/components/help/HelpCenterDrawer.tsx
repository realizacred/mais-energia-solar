/**
 * Central de Ajuda — Drawer/Dialog responsivo
 * §1: Cores semânticas
 * §22: Botões shadcn
 * §25: w-[90vw] max-w-2xl
 * §36: ScrollArea + min-h-0
 * §32: Mobile = Drawer, Desktop = Dialog
 */

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  useTutoriais,
  useBuscarTutoriais,
  useProgressoUsuario,
  useMarcarTutorialConcluido,
  type Tutorial,
} from "@/hooks/useHelpCenter";
import {
  HelpCircle,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Brain,
  MessageSquare,
  BarChart3,
  CheckCircle2,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";

const ICONES_CATEGORIA: Record<string, React.ElementType> = {
  inteligencia: Brain,
  comercial: BarChart3,
  whatsapp: MessageSquare,
  geral: BookOpen,
};

const CATEGORIAS = [
  { id: "inteligencia", label: "Inteligência", icon: Brain },
  { id: "comercial", label: "Comercial", icon: BarChart3 },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
] as const;

interface HelpCenterDrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function HelpCenterDrawer({ open: controlledOpen, onOpenChange }: HelpCenterDrawerProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(null);
  const [tutorialAberto, setTutorialAberto] = useState<Tutorial | null>(null);
  const [busca, setBusca] = useState("");

  const isDesktop = useMediaQuery("(min-width: 768px)");

  // All tutorials (unfiltered) for detail lookup
  const { data: todosTutoriais } = useTutoriais(null);
  // Filtered tutorials for list
  const { data: tutoriaisFiltrados } = useTutoriais(categoriaAtiva);
  const { data: resultadosBusca } = useBuscarTutoriais(busca);
  const { data: progresso } = useProgressoUsuario();
  const marcarConcluido = useMarcarTutorialConcluido();

  const tutoriaisExibidos = busca.trim().length >= 3 ? resultadosBusca : tutoriaisFiltrados;

  const handleAbrirTutorial = useCallback(
    (tutorial: Tutorial) => {
      setTutorialAberto(tutorial);
      marcarConcluido.mutate(tutorial.id);
    },
    [marcarConcluido]
  );

  const handleFechar = useCallback(() => {
    setOpen(false);
    // Reset state on close for clean re-open
    setTimeout(() => {
      setTutorialAberto(null);
      setBusca("");
      setCategoriaAtiva(null);
    }, 300);
  }, []);

  const totalConcluidos = progresso?.filter((p) => p.concluido).length ?? 0;
  const totalTutoriais = todosTutoriais?.length ?? 0;

  // ─── Inner content ───────────────────────────────────────────

  const renderLista = () => (
    <div className="flex flex-col h-full min-h-0">
      {/* Search + categories */}
      <div className="shrink-0 p-4 space-y-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tutoriais..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setBusca("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>

        {!busca && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={categoriaAtiva === null ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoriaAtiva(null)}
            >
              Todos
            </Button>
            {CATEGORIAS.map((cat) => {
              const Icon = cat.icon;
              return (
                <Button
                  key={cat.id}
                  variant={categoriaAtiva === cat.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCategoriaAtiva(cat.id)}
                  className="gap-1"
                >
                  <Icon className="w-3 h-3" />
                  {cat.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tutorial list — §36 */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {tutoriaisExibidos?.map((tutorial, index) => {
              const Icon = ICONES_CATEGORIA[tutorial.categoria] || BookOpen;
              const isConcluido = progresso?.some(
                (p) => p.tutorial_id === tutorial.id && p.concluido
              );

              return (
                <motion.div
                  key={tutorial.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <Button
                    variant="ghost"
                    className="w-full h-auto justify-start p-3 text-left hover:bg-muted/50"
                    onClick={() => handleAbrirTutorial(tutorial)}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm truncate">
                            {tutorial.titulo}
                          </span>
                          {isConcluido && (
                            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-normal">
                          {tutorial.descricao_curta}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px]">
                            {tutorial.categoria}
                          </Badge>
                          {tutorial.video_url && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <PlayCircle className="w-3 h-3" />
                              Vídeo
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {tutoriaisExibidos?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum tutorial encontrado.
            </p>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="shrink-0 p-3 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          {totalConcluidos} de {totalTutoriais} tutoriais concluídos
        </p>
      </div>
    </div>
  );

  const renderDetalhe = () => {
    if (!tutorialAberto) return null;
    const Icon = ICONES_CATEGORIA[tutorialAberto.categoria] || BookOpen;

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="shrink-0 p-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTutorialAberto(null)}
            className="mb-2 gap-1"
          >
            <ChevronLeft className="w-3 h-3" />
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground truncate">
                {tutorialAberto.titulo}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {tutorialAberto.descricao_curta}
              </p>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            <MarkdownRenderer
              content={tutorialAberto.conteudo}
              className="text-sm leading-relaxed"
            />

            {tutorialAberto.video_url && (
              <div className="mt-4 aspect-video bg-muted rounded-lg flex items-center justify-center gap-2">
                <PlayCircle className="w-10 h-10 text-muted-foreground" />
                <span className="text-muted-foreground text-sm">Vídeo tutorial</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const innerContent = tutorialAberto ? renderDetalhe() : renderLista();

  // ─── Render responsive container ────────────────────────────

  if (isDesktop) {
    return (
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleFechar())}>
          <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
            <DialogHeader className="shrink-0 p-5 pb-3 border-b border-border flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-base font-semibold text-foreground">
                  Central de Ajuda
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Tutoriais e guias para usar o sistema
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="flex-1 min-h-0 flex flex-col">{innerContent}</div>
          </DialogContent>
        </Dialog>
    );
  }

  // Mobile: Drawer
  return (
      <Drawer open={open} onOpenChange={(v) => (v ? setOpen(true) : handleFechar())}>
        <DrawerContent className="max-h-[calc(100dvh-2rem)] flex flex-col">
          <DrawerHeader className="shrink-0 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DrawerTitle className="text-base font-semibold text-foreground text-left">
                  Central de Ajuda
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground text-left">
                  Tutoriais e guias para usar o sistema
                </DrawerDescription>
              </div>
            </div>
          </DrawerHeader>
          <div className="flex-1 min-h-0 flex flex-col">{innerContent}</div>
        </DrawerContent>
      </Drawer>
  );
}
