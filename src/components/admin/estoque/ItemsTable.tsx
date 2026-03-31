import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { CATEGORIA_LABELS, type EstoqueSaldo } from "@/hooks/useEstoque";
import { formatBRL } from "@/lib/formatters";

interface ItemsTableProps {
  items: EstoqueSaldo[];
  onQrCode: (item: EstoqueSaldo) => void;
}

export function ItemsTable({ items, onQrCode }: ItemsTableProps) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
            <th className="text-left p-3 font-medium text-muted-foreground hidden sm:table-cell">Categoria</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Estoque</th>
            <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Reservado</th>
            <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Disponível</th>
            <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Mínimo</th>
            <th className="text-right p-3 font-medium text-muted-foreground hidden lg:table-cell">Custo Médio</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
            <th className="text-center p-3 font-medium text-muted-foreground w-10"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isLow = item.estoque_minimo > 0 && item.estoque_atual <= item.estoque_minimo;
            return (
              <tr key={item.item_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <div className="font-medium text-foreground">{item.nome}</div>
                  {item.sku && <div className="text-xs text-muted-foreground">{item.sku}</div>}
                </td>
                <td className="p-3 hidden sm:table-cell">
                  <Badge variant="outline" className="text-xs">{CATEGORIA_LABELS[item.categoria] || item.categoria}</Badge>
                </td>
                <td className={`p-3 text-right font-semibold ${isLow ? "text-destructive" : "text-foreground"}`}>
                  {item.estoque_atual} {item.unidade}
                </td>
                <td className="p-3 text-right text-warning hidden md:table-cell">
                  {item.reservado > 0 ? item.reservado : "—"}
                </td>
                <td className="p-3 text-right font-medium hidden md:table-cell">
                  {item.disponivel} {item.unidade}
                </td>
                <td className="p-3 text-right text-muted-foreground hidden md:table-cell">
                  {item.estoque_minimo} {item.unidade}
                </td>
                <td className="p-3 text-right text-muted-foreground hidden lg:table-cell">
                  R$ {Number(item.custo_medio).toFixed(2)}
                </td>
                <td className="p-3 text-center">
                  {isLow ? (
                    <Badge variant="destructive" className="text-[10px]">Baixo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-success border-success/30">OK</Badge>
                  )}
                </td>
                <td className="p-3 text-center">
                  <Button variant="ghost" size="icon-sm" onClick={() => onQrCode(item)} title="QR Code">
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
