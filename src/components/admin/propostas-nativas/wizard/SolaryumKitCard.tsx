import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "./types";
import type { ProdutoSolaryum } from "@/hooks/useSolaryumKits";

interface SolaryumKitCardProps {
  kit: ProdutoSolaryum;
  onSelect: (kit: ProdutoSolaryum) => void;
  selected?: boolean;
}

function stockBadge(kit: ProdutoSolaryum) {
  if (kit.estoque > 0) {
    return (
      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
        Em estoque
      </Badge>
    );
  }
  if (kit.dtDisponibilidade) {
    return (
      <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
        Sob encomenda
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
      Indisponível
    </Badge>
  );
}

export function SolaryumKitCard({ kit, onSelect, selected }: SolaryumKitCardProps) {
  // Potencia: API returns kWp directly
  const potenciaKwp = kit.potencia >= 100 ? kit.potencia / 1000 : kit.potencia;

  const composicaoResumo = (kit.composicao ?? []).slice(0, 4);

  return (
    <Card
      className={cn(
        "bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer",
        selected && "border-primary border-2"
      )}
      onClick={() => onSelect(kit)}
    >
      <CardContent className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground line-clamp-2">
              {kit.descricao || kit.modelo || "Kit Solaryum"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {potenciaKwp.toFixed(2)} kWp
            </p>
          </div>
          {stockBadge(kit)}
        </div>

        {/* Brands */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {kit.marcaPainel && (
            <span className="flex items-center gap-1">
              <Package className="w-3 h-3" /> {kit.marcaPainel}
            </span>
          )}
          {kit.marcaInversor && (
            <span className="flex items-center gap-1">
              ⚡ {kit.marcaInversor}
            </span>
          )}
        </div>

        {/* Composição resumo */}
        {composicaoResumo.length > 0 && (
          <div className="space-y-0.5">
            {composicaoResumo.map((c, i) => (
              <p key={i} className="text-xs text-muted-foreground truncate">
                {c.qtd ?? 1}x {c.descricao || c.categoria || "Item"}
              </p>
            ))}
            {(kit.composicao?.length ?? 0) > 4 && (
              <p className="text-xs text-muted-foreground/70">
                +{(kit.composicao?.length ?? 0) - 4} item(ns)
              </p>
            )}
          </div>
        )}

        {/* Price + Action */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <p className="text-base font-semibold text-foreground">
            {formatBRL(kit.precoVenda)}
          </p>
          <Button
            size="sm"
            variant={selected ? "default" : "outline"}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(kit);
            }}
          >
            {selected ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1" />
                Selecionado
              </>
            ) : (
              "Selecionar"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
