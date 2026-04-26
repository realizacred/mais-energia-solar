/**
 * FunnelRolesPanel — Configuração de papel de cada funil.
 *
 * Mostra todos os funis (projeto_funis e pipelines) com seu papel atual.
 * O sistema já sugeriu o papel automaticamente pelo nome — admin confirma ou ajusta.
 *
 * Governança:
 *  - RB-04: dados via hook
 *  - SRP: só renderização
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui-kit";
import {
  PAPEL_LABEL,
  useFunisComPapel,
  useUpdatePapelFunil,
  type PapelFunil,
} from "@/hooks/useFunnelGovernance";
import { toast } from "sonner";

const PAPEIS: PapelFunil[] = [
  "comercial",
  "engenharia",
  "suprimentos",
  "instalacao",
  "concessionaria",
  "pos_venda",
  "outro",
];

export function FunnelRolesPanel() {
  const { data, isLoading } = useFunisComPapel();
  const updateMut = useUpdatePapelFunil();

  if (isLoading) return <LoadingState />;

  const handleChange = async (
    id: string,
    origem: "projeto" | "pipeline",
    papel: PapelFunil,
  ) => {
    try {
      await updateMut.mutateAsync({ id, origem, papel });
      toast.success("Papel atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar papel");
    }
  };

  const projetos = (data ?? []).filter((f) => f.origem === "projeto");
  const pipelines = (data ?? []).filter((f) => f.origem === "pipeline");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funis de Execução (Projetos)</CardTitle>
          <CardDescription>
            Marque o papel de cada funil. O sistema sugeriu automaticamente pelo nome — confira
            e ajuste se necessário. A IA usa o papel (não o nome) para detectar incoerências.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FunilGroup
            rows={projetos}
            origem="projeto"
            onChange={handleChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funis Comerciais (Deals/Pipelines)</CardTitle>
          <CardDescription>
            Pipelines do mundo de negociação comercial.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FunilGroup
            rows={pipelines}
            origem="pipeline"
            onChange={handleChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FunilGroup({
  rows,
  origem,
  onChange,
}: {
  rows: ReturnType<typeof useFunisComPapel>["data"];
  origem: "projeto" | "pipeline";
  onChange: (id: string, origem: "projeto" | "pipeline", papel: PapelFunil) => void;
}) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum funil cadastrado.</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map((f) => (
        <div
          key={f.id}
          className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{f.nome}</p>
            <div className="flex items-center gap-2 mt-1">
              {!f.ativo && <Badge variant="outline">Inativo</Badge>}
              <Badge variant="secondary" className="text-xs">
                Atual: {PAPEL_LABEL[f.papel]}
              </Badge>
            </div>
          </div>
          <Select value={f.papel} onValueChange={(v) => onChange(f.id, origem, v as PapelFunil)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPEIS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PAPEL_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
