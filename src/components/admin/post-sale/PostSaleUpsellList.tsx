import { useState } from "react";
import { usePostSaleUpsells, useUpdateUpsellStatus, useCreateUpsell } from "@/hooks/usePostSale";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { TrendingUp } from "lucide-react";

const TIPO_LABELS: Record<string, string> = {
  bateria: "Bateria",
  expansao: "Expansão",
  carregador_ev: "Carregador EV",
  troca_inversor: "Troca Inversor",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  contatado: "bg-info/10 text-info border-info/30",
  vendido: "bg-success/10 text-success border-success/30",
  perdido: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  contatado: "Contatado",
  vendido: "Vendido",
  perdido: "Perdido",
};

export function PostSaleUpsellList() {
  const { data: upsells = [], isLoading } = usePostSaleUpsells();
  const updateStatus = useUpdateUpsellStatus();

  return (
    <div className="p-4 md:p-6">
      <SectionCard title="Oportunidades de Upsell" description={`${upsells.length} oportunidades`}>
        {upsells.length === 0 ? (
          <EmptyState icon={TrendingUp} title="Nenhuma oportunidade" description="Cadastre oportunidades de venda adicional para clientes instalados." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">CLIENTE</TableHead>
                <TableHead className="text-xs">TIPO</TableHead>
                <TableHead className="text-xs">DESCRIÇÃO</TableHead>
                <TableHead className="text-xs">STATUS</TableHead>
                <TableHead className="text-xs text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upsells.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="text-sm font-medium">{u.cliente?.nome ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{TIPO_LABELS[u.tipo] ?? u.tipo}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{u.descricao ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[u.status] ?? ""}`}>
                      {STATUS_LABELS[u.status] ?? u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {u.status === "pendente" && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs"
                        onClick={() => updateStatus.mutate({ id: u.id, status: "contatado" })}>
                        Marcar contatado
                      </Button>
                    )}
                    {u.status === "contatado" && (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-success"
                          onClick={() => updateStatus.mutate({ id: u.id, status: "vendido" })}>
                          Vendido
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                          onClick={() => updateStatus.mutate({ id: u.id, status: "perdido" })}>
                          Perdido
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

export default PostSaleUpsellList;
