import { useState } from "react";
import { Sun, Cpu, Pencil, LayoutGrid, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditarKitFechadoModal, type SelectedKit } from "./kit/EditarKitFechadoModal";
import { EditarLayoutModal } from "./kit/EditarLayoutModal";
import { toast } from "@/hooks/use-toast";
import type { KitItemRow, LayoutArranjo } from "./types";
import type { KitCardData } from "./kit/KitCard";

interface AdicionalItem {
  id: string;
  descricao: string;
  categoria: string;
  quantidade: number;
  preco_unitario: number;
}

interface StepAdicionaisProps {
  adicionais: AdicionalItem[];
  onAdicionaisChange: (adicionais: AdicionalItem[]) => void;
  itens: KitItemRow[];
  onItensChange: (itens: KitItemRow[]) => void;
  layouts: LayoutArranjo[];
  onLayoutsChange: (layouts: LayoutArranjo[]) => void;
  modulos?: any[];
  inversores?: any[];
}

export type { AdicionalItem };

function itensToKitCards(itens: KitItemRow[]): KitCardData[] {
  const modItem = itens.find(i => i.categoria === "modulo");
  const invItem = itens.find(i => i.categoria === "inversor");
  if (!modItem && !invItem) return [];

  const moduloQtd = modItem?.quantidade || 0;
  const moduloPotW = modItem?.potencia_w || 0;
  const totalKwp = (moduloQtd * moduloPotW) / 1000;
  const invPotKw = invItem ? (invItem.potencia_w || 0) / 1000 : 0;
  const precoTotal = itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const precoWp = totalKwp > 0 ? precoTotal / (totalKwp * 1000) : 0;

  return [{
    id: "kit-fechado",
    distribuidorNome: modItem?.fabricante || invItem?.fabricante || "",
    moduloDescricao: modItem ? `${modItem.fabricante} ${modItem.modelo}`.trim() : "—",
    moduloQtd,
    moduloPotenciaKwp: totalKwp,
    inversorDescricao: invItem ? `${invItem.fabricante} ${invItem.modelo}`.trim() : "—",
    inversorQtd: invItem?.quantidade || 0,
    inversorPotenciaKw: invPotKw * (invItem?.quantidade || 1),
    topologia: "Inversor string",
    precoTotal,
    precoWp,
  }];
}

export function StepAdicionais({
  adicionais, onAdicionaisChange,
  itens, onItensChange,
  layouts, onLayoutsChange,
  modulos = [], inversores = [],
}: StepAdicionaisProps) {
  const [showEditKit, setShowEditKit] = useState(false);
  const [showEditLayout, setShowEditLayout] = useState(false);

  const kitCards = itensToKitCards(itens);
  const modItem = itens.find(i => i.categoria === "modulo");
  const invItem = itens.find(i => i.categoria === "inversor");
  const totalModulos = itens.filter(i => i.categoria === "modulo").reduce((s, i) => s + i.quantidade, 0);

  const moduloQtd = modItem?.quantidade || 0;
  const moduloDesc = modItem ? `${modItem.modelo || modItem.descricao}`.replace(/^\d+x\s*/, "").trim() : "—";
  const totalKwp = modItem ? ((moduloQtd * (modItem.potencia_w || 0)) / 1000) : 0;

  const inversorQtd = invItem?.quantidade || 0;
  const inversorDesc = invItem ? `${invItem.modelo || invItem.descricao}`.replace(/^\d+x\s*/, "").trim() : "—";
  const totalKw = invItem ? ((inversorQtd * (invItem.potencia_w || 0)) / 1000) : 0;

  return (
    <div className="space-y-6">
      {/* ── Top row: Kit Fechado + Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
        {/* Kit Fechado */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">Kit Fechado</h3>
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            {modItem || invItem ? (
              <>
                <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
                  {/* Module */}
                  {modItem && (
                    <div className="flex items-start gap-2.5">
                      <div className="h-9 w-9 rounded bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Sun className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {moduloQtd}x {moduloDesc}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Total: {totalKwp.toFixed(2)} kWp
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Inverter */}
                  {invItem && (
                    <div className="flex items-start gap-2.5">
                      <div className="h-9 w-9 rounded bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {inversorQtd}x {inversorDesc}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Total: {totalKw.toFixed(2)} kW
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-border" />

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setShowEditKit(true)}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum kit selecionado na etapa anterior.
              </p>
            )}
          </div>
        </div>

        {/* Layout */}
        <div className="space-y-2 lg:min-w-[320px] lg:max-w-[420px] lg:flex-1">
          <h3 className="text-sm font-bold text-foreground">Layout</h3>
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            {layouts.length > 0 ? (
              <>
                <div className="space-y-2">
                  {layouts.map((arranjo) => (
                    <div key={arranjo.id} className="flex items-start gap-2.5">
                      <div className="h-9 w-9 rounded bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          Arranjo {arranjo.arranjo_index}:{" "}
                          <span className="font-normal text-muted-foreground">
                            {arranjo.num_linhas} linha{arranjo.num_linhas > 1 ? "s" : ""} de {arranjo.modulos_por_linha} módulos na {arranjo.disposicao}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border" />

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setShowEditLayout(true)}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-2.5">
                  <div className="h-9 w-9 rounded bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                    <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    Nenhum layout definido.
                  </p>
                </div>

                <div className="border-t border-border" />

                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setShowEditLayout(true)}
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-border" />

      {/* ── Adicionais ── */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-foreground">Adicionais</h3>
        <div className="flex items-start gap-2.5 py-8">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            Utilize um distribuidor SolarMarket para ter opções adicionais de componentes.
          </p>
        </div>
      </div>

      {/* ── Modals ── */}
      <EditarKitFechadoModal
        open={showEditKit}
        onOpenChange={setShowEditKit}
        kits={kitCards}
        onSave={(selected) => {
          // Preserve existing prices from current itens
          const existingModPrice = itens.find(i => i.categoria === "modulo")?.preco_unitario || 0;
          const existingInvPrice = itens.find(i => i.categoria === "inversor")?.preco_unitario || 0;
          const newItens: KitItemRow[] = selected.flatMap(({ kit, quantidade }) => [
            {
              id: crypto.randomUUID(),
              descricao: `${kit.moduloQtd * quantidade}x ${kit.moduloDescricao}`,
              fabricante: kit.distribuidorNome,
              modelo: kit.moduloDescricao,
              potencia_w: (kit.moduloPotenciaKwp * 1000) / kit.moduloQtd,
              quantidade: kit.moduloQtd * quantidade,
              preco_unitario: existingModPrice,
              categoria: "modulo" as const,
              avulso: false,
            },
            {
              id: crypto.randomUUID(),
              descricao: `${kit.inversorQtd * quantidade}x ${kit.inversorDescricao}`,
              fabricante: kit.distribuidorNome,
              modelo: kit.inversorDescricao,
              potencia_w: kit.inversorPotenciaKw * 1000,
              quantidade: kit.inversorQtd * quantidade,
              preco_unitario: existingInvPrice,
              categoria: "inversor" as const,
              avulso: false,
            },
          ]);
          onItensChange(newItens);
          toast({ title: "Kit atualizado" });
        }}
      />

      <EditarLayoutModal
        open={showEditLayout}
        onOpenChange={setShowEditLayout}
        layouts={layouts}
        totalModulos={totalModulos}
        onSave={(newLayouts) => {
          onLayoutsChange(newLayouts);
          toast({ title: "Layout atualizado" });
        }}
      />
    </div>
  );
}
