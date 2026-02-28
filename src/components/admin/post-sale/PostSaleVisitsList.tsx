import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePostSaleVisits, useUpdateVisitStatus, useCreateVisit, PostSaleVisit } from "@/hooks/usePostSale";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui-kit/EmptyState";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-warning/10 text-warning border-warning/30",
  agendado: "bg-info/10 text-info border-info/30",
  concluido: "bg-success/10 text-success border-success/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

const TIPO_LABELS: Record<string, string> = {
  preventiva: "Preventiva",
  limpeza: "Limpeza",
  suporte: "Suporte",
  vistoria: "Vistoria",
  corretiva: "Corretiva",
};

export function PostSaleVisitsList() {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [selectedVisit, setSelectedVisit] = useState<PostSaleVisit | null>(null);
  const [conclusionNotes, setConclusionNotes] = useState("");

  const { data: visits = [], isLoading } = usePostSaleVisits({
    status: filterStatus === "all" ? undefined : filterStatus,
    tipo: filterTipo === "all" ? undefined : filterTipo,
  });
  const updateStatus = useUpdateVisitStatus();

  const handleConcluir = () => {
    if (!selectedVisit) return;
    updateStatus.mutate(
      { id: selectedVisit.id, status: "concluido", observacoes: conclusionNotes || undefined },
      { onSuccess: () => { setSelectedVisit(null); setConclusionNotes(""); } }
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <SectionCard title="Visitas" description={`${visits.length} registros`}>
        {visits.length === 0 ? (
          <EmptyState icon={Clock} title="Nenhuma visita encontrada" description="Ajuste os filtros ou aguarde projetos instalados." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">CLIENTE</TableHead>
                <TableHead className="text-xs">PROJETO</TableHead>
                <TableHead className="text-xs">TIPO</TableHead>
                <TableHead className="text-xs">DATA PREVISTA</TableHead>
                <TableHead className="text-xs">STATUS</TableHead>
                <TableHead className="text-xs text-right">AÇÕES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map(v => {
                const isLate = v.data_prevista && v.status !== "concluido" && v.status !== "cancelado" && isPast(new Date(v.data_prevista));
                return (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm font-medium">{v.cliente?.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.projeto?.codigo ?? v.projeto?.nome ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{TIPO_LABELS[v.tipo] ?? v.tipo}</Badge></TableCell>
                    <TableCell className={`text-sm ${isLate ? "text-destructive font-medium" : ""}`}>
                      {v.data_prevista ? format(new Date(v.data_prevista), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[v.status] ?? ""}`}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => navigate(`/admin/pos-venda-visitas/${v.id}`)}>
                          <Eye className="h-3.5 w-3.5" /> Abrir
                        </Button>
                        {(v.status === "pendente" || v.status === "agendado") && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setSelectedVisit(v)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {/* Conclusion dialog */}
      <Dialog open={!!selectedVisit} onOpenChange={(o) => !o && setSelectedVisit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cliente: <strong>{selectedVisit?.cliente?.nome}</strong>
            </p>
            <Textarea
              placeholder="Observações da visita..."
              value={conclusionNotes}
              onChange={e => setConclusionNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedVisit(null)}>Cancelar</Button>
            <Button onClick={handleConcluir} disabled={updateStatus.isPending}>
              {updateStatus.isPending ? "Salvando..." : "Concluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PostSaleVisitsList;
