import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Link2, Truck, MapPin } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";

interface Props {
  premises: TenantPremises;
  onChange: React.Dispatch<React.SetStateAction<TenantPremises>>;
}

export function TabIntegracoes({ premises, onChange }: Props) {
  const [showVertys, setShowVertys] = useState(false);
  const [showJng, setShowJng] = useState(false);

  const set = <K extends keyof TenantPremises>(key: K, value: TenantPremises[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            Distribuidores Integrados — Solaryum
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Configure os tokens de acesso aos distribuidores integrados via API Solaryum.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Vertys */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Token Vertys</Label>
            <div className="relative">
              <Input
                type={showVertys ? "text" : "password"}
                value={premises.solaryum_token_vertys || ""}
                onChange={(e) => set("solaryum_token_vertys", e.target.value || "")}
                placeholder="Cole aqui o token fornecido pela Vertys"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowVertys((v) => !v)}
              >
                {showVertys ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Obtido no painel Solaryum da Vertys.
            </p>
          </div>

          {/* Token JNG */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Token JNG</Label>
            <div className="relative">
              <Input
                type={showJng ? "text" : "password"}
                value={premises.solaryum_token_jng || ""}
                onChange={(e) => set("solaryum_token_jng", e.target.value || "")}
                placeholder="Cole aqui o token fornecido pela JNG"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowJng((v) => !v)}
              >
                {showJng ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Obtido no painel Solaryum da JNG Solar.
            </p>
          </div>

          {/* CIF Descarga */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Incluir descarga no frete CIF</p>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, o frete CIF inclui serviço de descarga.
                </p>
              </div>
            </div>
            <Switch
              checked={premises.solaryum_cif_descarga || false}
              onCheckedChange={(v) => set("solaryum_cif_descarga", v)}
            />
          </div>

          {/* IBGE Fallback */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Código IBGE padrão
            </Label>
            <Input
              type="text"
              value={premises.solaryum_ibge_fallback || ""}
              onChange={(e) => set("solaryum_ibge_fallback", e.target.value || "")}
              placeholder="Ex: 3550308 (São Paulo)"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Usado quando o cliente não tem endereço cadastrado. Necessário para calcular frete.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
