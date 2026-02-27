import { usePostSalePlans } from "@/hooks/usePostSale";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { FileText } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/30",
  paused: "bg-warning/10 text-warning border-warning/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  paused: "Pausado",
  closed: "Encerrado",
};

export function PostSalePlansList() {
  const { data: plans = [], isLoading } = usePostSalePlans();

  return (
    <div className="p-4 md:p-6">
      <SectionCard title="Planos Pós-Venda" description={`${plans.length} planos cadastrados`}>
        {plans.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum plano" description="Planos são criados automaticamente quando um projeto é marcado como instalado." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">CLIENTE</TableHead>
                <TableHead className="text-xs">PROJETO</TableHead>
                <TableHead className="text-xs">STATUS</TableHead>
                <TableHead className="text-xs">INÍCIO</TableHead>
                <TableHead className="text-xs">PRÓX. PREVENTIVA</TableHead>
                <TableHead className="text-xs">PERIODICIDADE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">{p.cliente?.nome ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.projeto?.codigo ?? p.projeto?.nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLORS[p.status] ?? ""}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.data_inicio ? format(new Date(p.data_inicio), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.proxima_preventiva ? format(new Date(p.proxima_preventiva), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{p.periodicidade_meses} meses</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}

export default PostSalePlansList;
