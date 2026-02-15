import { Badge } from "@/components/ui/badge";
import { User, Zap, ChevronRight, Phone } from "lucide-react";
import type { ProjetoItem, ProjetoEtapa } from "@/hooks/useProjetoPipeline";
import { cn } from "@/lib/utils";

interface Props {
  projetos: ProjetoItem[];
  etapas: ProjetoEtapa[];
  onViewProjeto?: (projeto: ProjetoItem) => void;
}

const formatBRL = (v: number | null) => {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
};

const ETIQUETA_COLORS: Record<string, string> = {
  residencial: "bg-info/10 text-info dark:bg-info/20",
  comercial: "bg-warning/10 text-warning dark:bg-warning/20",
  industrial: "bg-secondary/10 text-secondary dark:bg-secondary/20",
  rural: "bg-success/10 text-success dark:bg-success/20",
};

export function ProjetoListView({ projetos, etapas, onViewProjeto }: Props) {
  const etapaMap = new Map(etapas.map(e => [e.id, e]));
  const sortedEtapas = [...etapas].sort((a, b) => a.ordem - b.ordem);

  if (projetos.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-16 flex flex-col items-center justify-center text-muted-foreground" style={{ boxShadow: "var(--shadow-sm)" }}>
        <p className="font-medium">Nenhum projeto encontrado</p>
        <p className="text-sm mt-1">Crie um novo projeto ou ajuste os filtros.</p>
      </div>
    );
  }

  // Group by etapa
  const grouped = sortedEtapas.map(etapa => {
    const items = projetos.filter(p => p.etapa_id === etapa.id);
    return { etapa, items };
  }).filter(g => g.items.length > 0);

  // Ungrouped (no etapa match)
  const ungrouped = projetos.filter(p => !p.etapa_id || !etapaMap.has(p.etapa_id));

  return (
    <div className="space-y-4">
      {grouped.map(({ etapa, items }) => {
        const totalValue = items.reduce((s, p) => s + (p.valor_total || 0), 0);

        return (
          <div key={etapa.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            {/* Group header */}
            <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: etapa.cor }} />
                <h3 className="text-sm font-bold text-foreground">{etapa.nome}</h3>
                <Badge variant="outline" className="text-[10px] h-5 font-semibold rounded-lg border-border/60">
                  {items.length} {items.length === 1 ? "projeto" : "projetos"}
                </Badge>
              </div>
              {totalValue > 0 && (
                <span className="text-sm font-bold text-foreground">{formatBRL(totalValue)}</span>
              )}
            </div>

            {/* Items */}
            <div className="divide-y divide-border/30">
              {items.map(projeto => (
                <ListRow key={projeto.id} projeto={projeto} etapa={etapa} onView={onViewProjeto} />
              ))}
            </div>
          </div>
        );
      })}

      {ungrouped.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-muted-foreground/30" />
            <h3 className="text-sm font-bold text-muted-foreground">Sem etapa</h3>
            <Badge variant="outline" className="text-[10px] h-5 font-semibold rounded-lg border-border/60">
              {ungrouped.length}
            </Badge>
          </div>
          <div className="divide-y divide-border/30">
            {ungrouped.map(projeto => (
              <ListRow key={projeto.id} projeto={projeto} etapa={null} onView={onViewProjeto} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── List Row ──────────────────────────────────────────

interface ListRowProps {
  projeto: ProjetoItem;
  etapa: ProjetoEtapa | null;
  onView?: (projeto: ProjetoItem) => void;
}

function ListRow({ projeto, etapa, onView }: ListRowProps) {
  return (
    <div
      className="flex items-center gap-4 py-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors"
      onClick={() => onView?.(projeto)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm truncate text-foreground">
            {projeto.cliente?.nome || projeto.codigo || "Sem nome"}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          {projeto.codigo && <span>{projeto.codigo}</span>}
          {projeto.consultor?.nome && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {projeto.consultor.nome}
            </span>
          )}
          {projeto.potencia_kwp && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-amarelo-sol" />
              {projeto.potencia_kwp} kWp
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-foreground">{formatBRL(projeto.valor_total)}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}
