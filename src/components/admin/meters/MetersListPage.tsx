/**
 * MetersListPage — Main list page for Medidores.
 */
import { useState, useMemo } from "react";
import { type MeterDevice } from "@/services/meterService";
import { useMetersListData } from "@/hooks/useMetersListData";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Search, Gauge, ArrowLeftRight, AlertTriangle, Wifi, WifiOff, Link2, Activity } from "lucide-react";
import { MeterLinkDialog } from "./MeterLinkDialog";

export default function MetersListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkDialogMeter, setLinkDialogMeter] = useState<MeterDevice | null>(null);

  const { meters, isLoading, error, getLinkedUC } = useMetersListData({
    online_status: statusFilter,
    search,
  });

  // CORREÇÃO 4 — KPI cards data
  const kpis = useMemo(() => {
    const total = meters.length;
    const online = meters.filter(m => m.online_status === "online").length;
    const offline = meters.filter(m => m.online_status === "offline").length;
    const linked = meters.filter(m => !!getLinkedUC(m.id)).length;
    return { total, online, offline, linked };
  }, [meters, getLinkedUC]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        icon={Gauge}
        title="Medidores"
        description="Dispositivos de medição IoT sincronizados via API"
      />

      {/* CORREÇÃO 4 — KPI Cards §27 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpis.total}</p>
              <p className="text-sm text-muted-foreground mt-1">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpis.online}</p>
              <p className="text-sm text-muted-foreground mt-1">Online</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpis.offline}</p>
              <p className="text-sm text-muted-foreground mt-1">Offline</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpis.linked}</p>
              <p className="text-sm text-muted-foreground mt-1">Vinculados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou device ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="unknown">Desconhecido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CORREÇÃO 2 — Skeleton no loading */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Erro ao carregar" description={String(error)} />
        ) : meters.length === 0 ? (
          <EmptyState
            icon={Gauge}
            title="Nenhum medidor encontrado"
            description="Medidores serão importados automaticamente ao configurar uma integração de API (ex: Tuya) em Integrações > APIs."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Device ID</TableHead>
                  <TableHead>UC Vinculada</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Leitura</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meters.map((m) => {
                  const linkedUC = getLinkedUC(m.id);
                  return (
                    <TableRow key={m.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/medidores/${m.id}`)}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.model || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{m.provider}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">{m.external_device_id}</TableCell>
                      <TableCell>
                        {linkedUC ? (
                          <span className="text-xs font-medium text-primary">{linkedUC.nome}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Não vinculado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {m.bidirectional_supported ? (
                            <Badge variant="outline" className="text-xs"><ArrowLeftRight className="w-3 h-3 mr-0.5" />Bidirecional</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Unidirecional</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant={m.online_status === "online" ? "success" : m.online_status === "offline" ? "destructive" : "muted"} dot>
                          {m.online_status === "online" ? "Online" : m.online_status === "offline" ? "Offline" : "—"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.last_reading_at ? new Date(m.last_reading_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setLinkDialogMeter(m)}>
                            {linkedUC ? "Trocar UC" : "Vincular UC"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {linkDialogMeter && (
        <MeterLinkDialog
          open={!!linkDialogMeter}
          onOpenChange={() => setLinkDialogMeter(null)}
          meter={linkDialogMeter}
        />
      )}
    </div>
  );
}
