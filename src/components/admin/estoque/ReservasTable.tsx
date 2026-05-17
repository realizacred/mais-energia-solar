import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConsumeReserva, useCancelReserva, type EstoqueReserva } from "@/hooks/useEstoque";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle, XCircle } from "lucide-react";

const statusStyles: Record<string, string> = {
  active: "bg-warning/10 text-warning",
  consumed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
};
const statusLabels: Record<string, string> = {
  active: "Ativa", consumed: "Consumida", cancelled: "Cancelada",
};

export function ReservasTable({ reservas }: { reservas: EstoqueReserva[] }) {
  const consumeReserva = useConsumeReserva();
  const cancelReserva = useCancelReserva();

  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Item</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Qtd</th>
            <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Referência</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
            <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Obs</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Ações</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
              </td>
              <td className="p-3 font-medium text-foreground">{r.item_nome}</td>
              <td className="p-3 text-right font-semibold">{r.quantidade_reservada}</td>
              <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">
                {r.ref_type ? `${r.ref_type}` : "—"}
              </td>
              <td className="p-3 text-center">
                <Badge className={`text-[10px] ${statusStyles[r.status] || ""}`}>
                  {statusLabels[r.status] || r.status}
                </Badge>
              </td>
              <td className="p-3 text-xs text-muted-foreground hidden md:table-cell max-w-[150px] truncate">
                {r.observacao || "—"}
              </td>
              <td className="p-3 text-center">
                {r.status === "active" && (
                  <div className="flex gap-1 justify-center">
                    <Button variant="ghost" size="icon-sm" title="Consumir (baixar estoque)"
                      disabled={consumeReserva.isPending}
                      onClick={() => consumeReserva.mutate({ reservaId: r.id })}
                    >
                      <CheckCircle className="h-4 w-4 text-success" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Cancelar reserva"
                      disabled={cancelReserva.isPending}
                      onClick={() => cancelReserva.mutate(r.id)}
                    >
                      <XCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
