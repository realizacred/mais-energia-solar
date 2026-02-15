import { useState, useMemo } from "react";
import { Package, Check, LayoutGrid, Eye, EyeOff, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { generateKits, formatBRL, type MockKit } from "./mockData";
import { calcSuggestedKwp, calcGeracaoEstimada, calcNumModulos, type WizKitItem } from "./wizardState";

interface Props {
  mediaMensal: number;
  selectedKitId: string | null;
  onSelectKit: (id: string, items: WizKitItem[], custoEquip: number) => void;
  orientacaoFator: number;
}

export function StepKitSelection({ mediaMensal, selectedKitId, onSelectKit, orientacaoFator }: Props) {
  const [showCost, setShowCost] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [layoutRows, setLayoutRows] = useState(2);
  const [layoutCols, setLayoutCols] = useState(5);

  const kwp = calcSuggestedKwp(mediaMensal);
  const kits = useMemo(() => generateKits(kwp), [kwp]);

  const handleSelect = (kit: MockKit) => {
    const numMod = calcNumModulos(kwp, kit.modulo.potencia_wp);
    const items: WizKitItem[] = [
      { tipo: "modulo", descricao: `${kit.modulo.fabricante} ${kit.modulo.modelo}`, fabricante: kit.modulo.fabricante, modelo: kit.modulo.modelo, quantidade: numMod, precoUnitario: 0 },
      { tipo: "inversor", descricao: `${kit.inversor.fabricante} ${kit.inversor.modelo}`, fabricante: kit.inversor.fabricante, modelo: kit.inversor.modelo, quantidade: 1, precoUnitario: 0 },
    ];
    const custoEquip = kwp * kit.precoBase_kwp;
    onSelectKit(kit.id, items, custoEquip);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5" /> Seleção de Kit
        </h4>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowCost(!showCost)}>
            {showCost ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showCost ? "Ocultar custo" : "Mostrar custo"}
          </Button>
          <Dialog open={layoutOpen} onOpenChange={setLayoutOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1">
                <LayoutGrid className="h-3 w-3" /> Editar Telhado
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-sm">Layout dos Painéis</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Linhas</Label>
                    <Input type="number" min={1} max={10} value={layoutRows} onChange={e => setLayoutRows(Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                  <div className="space-y-0.5">
                    <Label className="text-[10px]">Módulos/linha</Label>
                    <Input type="number" min={1} max={20} value={layoutCols} onChange={e => setLayoutCols(Number(e.target.value))} className="h-7 text-xs" />
                  </div>
                </div>
                <div className="border rounded-md p-3 bg-muted/30">
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${layoutCols}, 1fr)` }}>
                    {Array.from({ length: layoutRows * layoutCols }).map((_, i) => (
                      <div key={i} className="aspect-[2/3] bg-primary/20 border border-primary/30 rounded-sm flex items-center justify-center">
                        <span className="text-[7px] font-mono text-primary/50">{i + 1}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground text-center mt-2">{layoutRows * layoutCols} módulos • {layoutRows}×{layoutCols}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kit Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kits.map((kit, idx) => {
          const numMod = calcNumModulos(kwp, kit.modulo.potencia_wp);
          const geracao = calcGeracaoEstimada(kwp, orientacaoFator);
          const custo = kwp * kit.precoBase_kwp;
          const isSelected = selectedKitId === kit.id;
          const isRecommended = kit.tier === "standard";

          return (
            <motion.button
              key={kit.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
              onClick={() => handleSelect(kit)}
              className={cn(
                "relative p-3 rounded-md border-2 text-left transition-all",
                isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/50 hover:border-border bg-card",
                isRecommended && !isSelected && "ring-1 ring-primary/15",
              )}
            >
              {isRecommended && <Badge className="absolute -top-2 right-2 text-[8px] h-4 px-1.5">Recomendado</Badge>}
              {isSelected && <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />}

              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kit.label}</p>
              <p className="text-lg font-bold font-mono mt-0.5">{kwp.toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">kWp</span></p>

              {/* Specs table */}
              <div className="mt-2 space-y-0.5 text-[10px]">
                <Row label="Módulo" value={`${kit.modulo.fabricante} ${kit.modulo.potencia_wp}W`} />
                <Row label="Inversor" value={`${kit.inversor.fabricante} ${kit.inversor.potencia_kw}kW`} />
                <Row label="Qtd. Módulos" value={`${numMod} un`} />
                <Row label="Geração est." value={`${geracao.toLocaleString("pt-BR")} kWh/mês`} />
                <Row label="Degradação 25a" value={`${kit.degradacao25}%`} />
                <Row label="ROI" value={`~${kit.roiAnos} anos`} className="text-success" />
                <Row label="Garantia" value={`${kit.garantiaModulo}a mod. / ${kit.garantiaInversor}a inv.`} />
              </div>

              {showCost && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <Row label="Custo base" value={formatBRL(custo)} className="font-bold" />
                  <Row label="R$/kWp" value={formatBRL(kit.precoBase_kwp)} />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-medium", className)}>{value}</span>
    </div>
  );
}
