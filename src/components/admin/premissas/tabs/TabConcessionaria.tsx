import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Landmark } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";

interface Props {
  premises: TenantPremises;
  onChange: React.Dispatch<React.SetStateAction<TenantPremises>>;
}

export function TabConcessionaria({ premises, onChange }: Props) {
  const [novoMotivo, setNovoMotivo] = useState("");

  const motivos = premises.concessionaria_motivos_reprovacao || [];

  const adicionarMotivo = () => {
    const trimmed = novoMotivo.trim();
    if (!trimmed || motivos.includes(trimmed)) return;
    onChange(p => ({
      ...p,
      concessionaria_motivos_reprovacao: [...(p.concessionaria_motivos_reprovacao || []), trimmed],
    }));
    setNovoMotivo("");
  };

  const removerMotivo = (idx: number) => {
    onChange(p => ({
      ...p,
      concessionaria_motivos_reprovacao: (p.concessionaria_motivos_reprovacao || []).filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Motivos de reprovação */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
              <Landmark className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Motivos de reprovação</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sugestões exibidas ao registrar reprovação de vistoria
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {motivos.map((m, i) => (
              <Badge key={i} variant="outline" className="text-xs gap-1.5 pr-1.5">
                {m}
                <button
                  type="button"
                  onClick={() => removerMotivo(i)}
                  className="ml-1 rounded-full p-0.5 hover:bg-destructive/10 transition-colors"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={novoMotivo}
              onChange={e => setNovoMotivo(e.target.value)}
              placeholder="Novo motivo..."
              className="max-w-sm"
              onKeyDown={e => e.key === "Enter" && (e.preventDefault(), adicionarMotivo())}
            />
            <Button variant="outline" onClick={adicionarMotivo} disabled={!novoMotivo.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prazo padrão */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Prazo padrão para vistoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dias após instalação</Label>
              <Input
                type="number"
                min={1}
                value={premises.concessionaria_prazo_vistoria_dias ?? 30}
                onChange={e => onChange(p => ({
                  ...p,
                  concessionaria_prazo_vistoria_dias: parseInt(e.target.value) || 30,
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Informativo — prazo sugerido para solicitar vistoria após conclusão da instalação
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
