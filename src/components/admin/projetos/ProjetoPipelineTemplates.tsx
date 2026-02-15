import { useState } from "react";
import { Zap, FileText, Wrench, DollarSign, Headphones, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  stages: { name: string; probability: number; is_closed?: boolean; is_won?: boolean; categoria?: string }[];
}

const TEMPLATES: PipelineTemplate[] = [
  {
    id: "sdr",
    name: "SDR / Prospecção",
    description: "Qualificação inicial de leads e agendamento de visitas",
    icon: Headphones,
    stages: [
      { name: "Novo Lead", probability: 5 },
      { name: "Tentativa de Contato", probability: 10 },
      { name: "Contato Realizado", probability: 20 },
      { name: "Qualificado (MQL)", probability: 40 },
      { name: "Visita Agendada", probability: 60 },
      { name: "Passado p/ Vendas", probability: 80, is_closed: true, is_won: true, categoria: "ganho" },
      { name: "Descartado", probability: 0, is_closed: true, is_won: false, categoria: "perdido" },
    ],
  },
  {
    id: "vendas",
    name: "Vendas (Micro/Mini GD)",
    description: "Pipeline comercial completo para projetos de geração distribuída",
    icon: Zap,
    stages: [
      { name: "Qualificação Técnica", probability: 10 },
      { name: "Visita Técnica", probability: 25 },
      { name: "Proposta Gerada", probability: 40 },
      { name: "Proposta Enviada", probability: 55 },
      { name: "Negociação", probability: 70 },
      { name: "Contrato Assinado", probability: 90 },
      { name: "Ganho", probability: 100, is_closed: true, is_won: true, categoria: "ganho" },
      { name: "Perdido", probability: 0, is_closed: true, is_won: false, categoria: "perdido" },
    ],
  },
  {
    id: "estudo_tecnico",
    name: "Estudo Técnico",
    description: "Acompanhamento de estudos técnicos e projetos elétricos",
    icon: Wrench,
    stages: [
      { name: "Aguardando Documentos", probability: 10 },
      { name: "Análise de Viabilidade", probability: 25 },
      { name: "Projeto Elétrico", probability: 45 },
      { name: "Homologação", probability: 65 },
      { name: "Aprovado", probability: 90 },
      { name: "Concluído", probability: 100, is_closed: true, is_won: true, categoria: "ganho" },
      { name: "Reprovado", probability: 0, is_closed: true, is_won: false, categoria: "perdido" },
    ],
  },
  {
    id: "financeiro",
    name: "Financeiro",
    description: "Controle de financiamentos e pagamentos",
    icon: DollarSign,
    stages: [
      { name: "Proposta Aceita", probability: 20 },
      { name: "Análise de Crédito", probability: 35 },
      { name: "Crédito Aprovado", probability: 55 },
      { name: "Contrato Financeiro", probability: 70 },
      { name: "Pagamento Liberado", probability: 90 },
      { name: "Finalizado", probability: 100, is_closed: true, is_won: true, categoria: "ganho" },
      { name: "Crédito Negado", probability: 0, is_closed: true, is_won: false, categoria: "perdido" },
    ],
  },
  {
    id: "pos_venda",
    name: "Pós-Venda / Instalação",
    description: "Gestão da instalação e ativação do sistema",
    icon: FileText,
    stages: [
      { name: "Compra de Materiais", probability: 15 },
      { name: "Instalação Agendada", probability: 30 },
      { name: "Em Instalação", probability: 55 },
      { name: "Comissionamento", probability: 75 },
      { name: "Vistoria Concessionária", probability: 90 },
      { name: "Sistema Ativo", probability: 100, is_closed: true, is_won: true, categoria: "ganho" },
      { name: "Cancelado", probability: 0, is_closed: true, is_won: false, categoria: "perdido" },
    ],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateFromTemplate: (name: string, stages: PipelineTemplate["stages"]) => void;
  onCreateBlank: (name: string) => void;
}

export function ProjetoPipelineTemplates({ open, onOpenChange, onCreateFromTemplate, onCreateBlank }: Props) {
  const [mode, setMode] = useState<"select" | "blank">("select");
  const [blankName, setBlankName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PipelineTemplate | null>(null);
  const [customName, setCustomName] = useState("");

  const handleConfirmTemplate = () => {
    if (!selectedTemplate) return;
    const name = customName.trim() || selectedTemplate.name;
    onCreateFromTemplate(name, selectedTemplate.stages);
    reset();
  };

  const handleConfirmBlank = () => {
    if (!blankName.trim()) return;
    onCreateBlank(blankName.trim());
    reset();
  };

  const reset = () => {
    setMode("select");
    setBlankName("");
    setSelectedTemplate(null);
    setCustomName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Novo Funil</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Escolha um template pré-configurado ou crie do zero.
          </DialogDescription>
        </DialogHeader>

        {!selectedTemplate && mode === "select" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => { setSelectedTemplate(tpl); setCustomName(tpl.name); }}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border border-border/60 text-left",
                    "hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  )}
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <tpl.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{tpl.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{tpl.description}</p>
                    <Badge variant="outline" className="text-[9px] mt-1.5 h-4 px-1">
                      {tpl.stages.length} etapas
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>

            <div className="border-t border-border/40 pt-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-sm text-muted-foreground"
                onClick={() => setMode("blank")}
              >
                <Plus className="h-4 w-4" />
                Criar funil em branco
              </Button>
            </div>
          </div>
        )}

        {/* Template Preview */}
        {selectedTemplate && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <selectedTemplate.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{selectedTemplate.name}</p>
                <p className="text-[11px] text-muted-foreground">{selectedTemplate.description}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Nome do funil (personalizável)
              </label>
              <Input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="h-9 text-sm"
                placeholder={selectedTemplate.name}
              />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Etapas que serão criadas:</p>
              <div className="flex items-stretch gap-0 overflow-x-auto">
                {selectedTemplate.stages.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "relative flex items-center justify-center px-2.5 py-1.5 text-[10px] font-medium min-w-0 flex-1 truncate",
                      i === 0 && "rounded-l-md",
                      i === selectedTemplate.stages.length - 1 && "rounded-r-md",
                      s.is_won
                        ? "bg-success/15 text-success"
                        : s.is_closed
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                    )}
                  >
                    <span className="truncate">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>Voltar</Button>
              <Button onClick={handleConfirmTemplate}>
                Criar Funil
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Blank Mode */}
        {mode === "blank" && !selectedTemplate && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Nome do funil
              </label>
              <Input
                value={blankName}
                onChange={e => setBlankName(e.target.value)}
                className="h-9 text-sm"
                placeholder="Ex: Meu funil customizado"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleConfirmBlank(); }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Etapas padrão (Novo, Qualificação, Proposta, Negociação, Ganho, Perdido) serão criadas automaticamente.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode("select")}>Voltar</Button>
              <Button onClick={handleConfirmBlank} disabled={!blankName.trim()}>
                Criar Funil
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
