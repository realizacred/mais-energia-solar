import { Badge } from "@/components/ui/badge";
import { TIPO_MOVIMENTO_LABELS, type EstoqueMovimento } from "@/hooks/useEstoque";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/formatters";

const tipoStyles: Record<string, string> = {
  entrada: "bg-success/10 text-success",
  saida: "bg-destructive/10 text-destructive",
  ajuste: "bg-warning/10 text-warning",
  transferencia: "bg-info/10 text-info",
};

export function MovementsTable({ movements }: { movements: EstoqueMovimento[] }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
            <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Local</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Tipo</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Qtd</th>
            <th className="text-right p-3 font-medium text-muted-foreground hidden sm:table-cell">Custo Un.</th>
            <th className="text-left p-3 font-medium text-muted-foreground hidden lg:table-cell">Origem</th>
            <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Obs</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => {
            const sign = m.tipo === "saida" ? "-"
              : m.tipo === "ajuste" && m.ajuste_sinal === -1 ? "-"
              : "+";
            return (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                </td>
                <td className="p-3 font-medium text-foreground">{m.item_nome}</td>
                <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">{m.local_nome}</td>
                <td className="p-3 text-center">
                  <Badge className={`text-[10px] ${tipoStyles[m.tipo] || ""}`}>
                    {TIPO_MOVIMENTO_LABELS[m.tipo] || m.tipo}
                    {m.tipo === "ajuste" && (m.ajuste_sinal === -1 ? " ▼" : " ▲")}
                  </Badge>
                </td>
                <td className="p-3 text-right font-semibold">
                  {sign}{m.quantidade}
                </td>
                <td className="p-3 text-right text-muted-foreground hidden sm:table-cell">
                  {m.custo_unitario ? formatBRL(Number(m.custo_unitario)) : "—"}
                </td>
                <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">{m.origem}</td>
                <td className="p-3 text-xs text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                  {m.observacao || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
