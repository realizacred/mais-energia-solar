import { Sun, Cpu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "../types";

export interface KitCardData {
  id: string;
  distribuidorNome: string;
  moduloDescricao: string;
  moduloQtd: number;
  moduloPotenciaKwp: number;
  inversorDescricao: string;
  inversorQtd: number;
  inversorPotenciaKw: number;
  topologia: string;
  precoTotal: number;
  precoWp: number;
  tipoEstrutura?: string;
  updatedAt?: string;
}

interface KitCardProps {
  kit: KitCardData;
  onSelect: (kit: KitCardData) => void;
  viewMode: "grid" | "list";
}

export function KitCard({ kit, onSelect, viewMode }: KitCardProps) {
  if (viewMode === "list") {
    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-border/40 hover:border-primary/30 transition-all bg-card">
        {/* Distributor placeholder */}
        <div className="w-20 h-14 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase text-center leading-tight px-1">
            {kit.distribuidorNome || "—"}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs font-bold truncate">
            {kit.moduloQtd}x {kit.moduloDescricao} + {kit.inversorQtd}x {kit.inversorDescricao}
          </p>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sun className="h-3 w-3" />
              {kit.moduloQtd}x {kit.moduloDescricao}
            </span>
            <span>Total {kit.moduloPotenciaKwp.toFixed(2)} kWp</span>
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              {kit.inversorQtd}x {kit.inversorDescricao}
            </span>
            <span>Total {kit.inversorPotenciaKw.toFixed(2)} kW</span>
            <span>Topologia: {kit.topologia}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold">{formatBRL(kit.precoTotal)}</span>
            <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 border-primary/20 text-primary">
              {formatBRL(kit.precoWp)} / Wp
            </Badge>
          </div>
        </div>

        {/* Select */}
        <Button size="sm" className="gap-1 h-8 text-xs shrink-0" onClick={() => onSelect(kit)}>
          <Plus className="h-3 w-3" /> Selecionar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-border/40 hover:border-primary/30 transition-all bg-card p-4 space-y-3">
      {/* Distributor */}
      <div className="h-10 flex items-center">
        <span className="text-sm font-bold text-secondary uppercase">{kit.distribuidorNome || "—"}</span>
      </div>
      <div className="border-t border-border/30" />

      {/* Module */}
      <div className="flex items-start gap-2 text-xs">
        <Sun className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">{kit.moduloQtd} {kit.moduloDescricao}</p>
          <p className="text-[10px] text-muted-foreground">Total {kit.moduloPotenciaKwp.toFixed(2)} kWp</p>
        </div>
      </div>

      {/* Inverter */}
      <div className="flex items-start gap-2 text-xs">
        <Cpu className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">{kit.inversorQtd} {kit.inversorDescricao}</p>
          <p className="text-[10px] text-muted-foreground">Total {kit.inversorPotenciaKw.toFixed(2)} kW</p>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1 text-xs">
        <p className="text-muted-foreground"><span className="font-medium text-foreground">Topologia</span></p>
        <p>{kit.topologia}</p>
        {kit.tipoEstrutura && (
          <>
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Tipo de estrutura</span></p>
            <p>{kit.tipoEstrutura}</p>
          </>
        )}
      </div>

      {/* Price */}
      <div className="space-y-1">
        <Badge variant="outline" className="text-[10px] h-5 bg-primary/5 border-primary/20 text-primary">
          {formatBRL(kit.precoWp)} / Wp
        </Badge>
        <p className="text-sm font-bold">
          Total: <span className="text-primary">{formatBRL(kit.precoTotal)}</span>
        </p>
        {kit.updatedAt && (
          <p className="text-[10px] text-muted-foreground">Última atualização: {kit.updatedAt}</p>
        )}
      </div>
    </div>
  );
}
