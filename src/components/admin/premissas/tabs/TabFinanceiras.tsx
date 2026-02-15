import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

export function TabFinanceiras({ premises, onChange }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Col 1 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Inflação Energética</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={premises.inflacao_energetica}
                onChange={(e) => set("inflacao_energetica", Number(e.target.value))}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">%</span>
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">VPL - Taxa de Desconto</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={premises.vpl_taxa_desconto}
                onChange={(e) => set("vpl_taxa_desconto", Number(e.target.value))}
                className="pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">%</span>
            </div>
          </div>

          {/* Col 3 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Considerar custo de disponibilidade?</Label>
            <Select
              value={premises.considerar_custo_disponibilidade ? "sim" : "nao"}
              onValueChange={(v) => set("considerar_custo_disponibilidade", v === "sim")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
            <p className="flex items-center gap-1 text-[11px] text-primary">
              <Info className="h-3 w-3" />
              Afeta somente na Regra Anterior
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
